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
  upsertMemoryVector,
} from "@/agent/memory/vectorMemory"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"

export const memoryRoutes = new Hono<AppBindings>()

memoryRoutes.use("*", authMiddleware)

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
  await upsertMemoryVector(c.env, {
    id,
    userId: user.id,
    conversationId: existing.conversation_id ?? "",
    type: existing.type,
    content: input.content,
    createdAt: existing.created_at,
  })
  await invalidateLongTermMemoryCache(c.env, user.id)

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
  const result = await c.env.DB.prepare(
    "DELETE FROM memories WHERE user_id = ? AND id = ?",
  )
    .bind(user.id, id)
    .run()

  if (!result.meta?.changes) {
    return c.json({ error: "记忆不存在" }, 404)
  }

  await deleteMemoryVector(c.env, id)
  await invalidateLongTermMemoryCache(c.env, user.id)
  return c.json({ ok: true })
})
