import { Hono } from "hono"
import {
  memoriesResponseSchema,
  memoryContextResponseSchema,
  memorySchema,
  updateMemoryRequestSchema,
} from "@ai-companion/shared"
import { invalidateLongTermMemoryCache } from "@/agent/memory/longTermMemory"
import {
  deleteMemoryVector,
  isVectorStorageSkipped,
  upsertMemoryVector,
} from "@/agent/memory/vectorMemory"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"

export const memoryRoutes = new Hono<AppBindings>()

memoryRoutes.use("*", authMiddleware)

// 清理刚确认过所有权、但 D1 行删除竞态失败的孤儿向量。向量 id 是随机
// UUID，未经过所有权确认的 id 不应触发向量删除。
async function cleanupOrphanMemoryVector(
  env: AppBindings["Bindings"],
  id: string,
) {
  try {
    await deleteMemoryVector(env, id)
  } catch (error) {
    console.error("Failed to clean up orphan memory vector", error)
  }
}

type MemoryRow = {
  id: string
  conversation_id: string | null
  type: "event" | "preference" | "emotion_snapshot"
  content: string
  created_at: number
}

type MemoryContextMessageRow = {
  id: string
  role: "user" | "agent"
  content: string
  created_at: number
}

function parseMemoryRow(row: MemoryRow) {
  return memorySchema.parse({
    id: row.id,
    type: row.type,
    content: row.content,
    created_at: row.created_at,
  })
}

memoryRoutes.get("/", async (c) => {
  const user = c.get("user")
  const rows = await c.env.DB.prepare(
    `SELECT id, conversation_id, type, content, created_at
     FROM memories
     WHERE user_id = ?
     ORDER BY created_at DESC, rowid DESC
     LIMIT 100`,
  )
    .bind(user.id)
    .all<MemoryRow>()
    .then((result) => result.results ?? [])

  return c.json(
    memoriesResponseSchema.parse({
      memories: rows.map(parseMemoryRow),
    }),
  )
})

memoryRoutes.get("/:id/context", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const memory = await c.env.DB.prepare(
    `SELECT id, conversation_id, type, content, created_at
     FROM memories
     WHERE user_id = ? AND id = ?`,
  )
    .bind(user.id, id)
    .first<MemoryRow>()

  if (!memory) {
    return c.json({ error: "记忆不存在" }, 404)
  }
  if (!memory.conversation_id) {
    return c.json(memoryContextResponseSchema.parse({ messages: [] }))
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE user_id = ?
       AND conversation_id = ?
       AND created_at <= ?
     ORDER BY created_at DESC, rowid DESC
     LIMIT 6`,
  )
    .bind(user.id, memory.conversation_id, memory.created_at)
    .all<MemoryContextMessageRow>()
    .then((result) => result.results ?? [])

  return c.json(
    memoryContextResponseSchema.parse({
      messages: rows.reverse(),
    }),
  )
})

memoryRoutes.patch("/:id", async (c) => {
  const input = updateMemoryRequestSchema.parse(await c.req.json())
  const user = c.get("user")
  const id = c.req.param("id")

  const existing = await c.env.DB.prepare(
    `SELECT id, conversation_id, type, content, created_at
     FROM memories
     WHERE user_id = ? AND id = ?`,
  )
    .bind(user.id, id)
    .first<MemoryRow>()

  if (!existing) {
    return c.json({ error: "记忆不存在" }, 404)
  }

  await c.env.DB.prepare(
    "UPDATE memories SET content = ? WHERE user_id = ? AND id = ?",
  )
    .bind(input.content, user.id, id)
    .run()

  // D1 是记忆的唯一事实来源；向量是它的投影。先写 D1 再同步向量，
  // 投影最多滞后，不会超前。除环境未开通外，向量同步失败按错误返回，
  // 让使用者重试，避免旧内容长期残留在检索结果里。
  let vectorSyncFailed = false
  await upsertMemoryVector(c.env, {
    id,
    userId: user.id,
    conversationId: existing.conversation_id ?? "",
    type: existing.type,
    content: input.content,
    createdAt: existing.created_at,
    onVectorResult: (result) => {
      vectorSyncFailed =
        !result.success && !isVectorStorageSkipped(result.reason)
    },
  })
  await invalidateLongTermMemoryCache(c.env, user.id)

  if (vectorSyncFailed) {
    throw new Error("记忆已更新，但记忆检索索引同步失败")
  }

  return c.json(
    parseMemoryRow({
      ...existing,
      content: input.content,
    }),
  )
})

memoryRoutes.delete("/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const existing = await c.env.DB.prepare(
    "SELECT id FROM memories WHERE user_id = ? AND id = ?",
  )
    .bind(user.id, id)
    .first<{ id: string }>()

  if (!existing) {
    return c.json({ error: "记忆不存在" }, 404)
  }

  // 先删向量再删 D1 行：向量删除失败时行还在，使用者重试即可收敛；
  // 反过来先删行会让向量变成无人能再定位的孤儿。
  await deleteMemoryVector(c.env, id)
  const result = await c.env.DB.prepare(
    "DELETE FROM memories WHERE user_id = ? AND id = ?",
  )
    .bind(user.id, id)
    .run()

  if (!result.meta?.changes) {
    // 所有权刚确认过（并发删除竞态），孤儿向量可以安全清理。
    await cleanupOrphanMemoryVector(c.env, id)
    return c.json({ error: "记忆不存在" }, 404)
  }

  await invalidateLongTermMemoryCache(c.env, user.id)
  return c.json({ ok: true })
})
