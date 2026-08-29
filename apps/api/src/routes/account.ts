import { Hono } from "hono"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"
import { ensureChatMessagesTable } from "@/chat/history"
import { invalidateLongTermMemoryCache } from "@/agent/memory/longTermMemory"
import { deleteMemoryVectorsByIds } from "@/agent/memory/vectorMemory"
import { deleteRecentContexts } from "@/agent/nodes/persist"
import { deleteChatConversationData } from "@/chat/conversations"
import { ensureChatProfilesTable } from "@/routes/profiles"
import { ensureRelationshipStatesTable } from "@/agent/relationship/stateMachine"

export const accountRoutes = new Hono<AppBindings>()

async function deleteLongTermMemory(
  env: AppBindings["Bindings"],
  userId: string,
) {
  await env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?")
    .bind(userId)
    .run()
  await deleteMemoryVectorsForUser(env, userId)
  await env.DB.prepare("DELETE FROM memories WHERE user_id = ?")
    .bind(userId)
    .run()
  await env.DB.prepare("DELETE FROM conversation_summaries WHERE user_id = ?")
    .bind(userId)
    .run()
  await ensureChatMessagesTable(env)
  await env.DB.prepare("DELETE FROM chat_messages WHERE user_id = ?")
    .bind(userId)
    .run()
  await ensureChatProfilesTable(env)
  await env.DB.prepare("DELETE FROM chat_profiles WHERE user_id = ?")
    .bind(userId)
    .run()
  await deleteChatConversationData(env, userId)
  await ensureRelationshipStatesTable(env)
  await env.DB.prepare("DELETE FROM relationship_states WHERE user_id = ?")
    .bind(userId)
    .run()
}

// 向量 id 就是 memories.id，必须在删除 D1 行之前按 id 清理向量，
// 否则行删除后无法再定位向量；清理失败直接抛出让使用者可重试。
async function deleteMemoryVectorsForUser(
  env: AppBindings["Bindings"],
  userId: string,
) {
  const rows = await env.DB.prepare(
    "SELECT id FROM memories WHERE user_id = ?",
  )
    .bind(userId)
    .all<{ id: string }>()
  const ids = (rows.results ?? []).map((row) => row.id)
  if (ids.length > 0) {
    await deleteMemoryVectorsByIds(env, ids)
  }
}

// 数据清理放在软删除与 token 撤销之前：中途失败时使用者仍持有有效
// 凭据可重试；所有删除操作都是幂等的，重试安全。
accountRoutes.delete("/", authMiddleware, async (c) => {
  const user = c.get("user")
  await deleteLongTermMemory(c.env, user.id)
  await c.env.CHAT_CONTEXT.delete(`ctx:${user.id}`)
  await deleteRecentContexts(c.env, user.id)
  await c.env.CHAT_CONTEXT.delete(`mood:${user.id}`)
  await invalidateLongTermMemoryCache(c.env, user.id)
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare(
    "UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(now, now, user.id)
    .run()
  await c.env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
  )
    .bind(now, user.id)
    .run()
  return c.json({ ok: true })
})
