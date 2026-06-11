import { chatHistoryResponseSchema } from "@ai-companion/shared"
import { Hono } from "hono"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"
import { ensureChatMessagesTable } from "@/chat/history"

export const chatRoutes = new Hono<AppBindings>()

chatRoutes.use("*", authMiddleware)

chatRoutes.get("/history", async (c) => {
  const user = c.get("user")
  await ensureChatMessagesTable(c.env)
  const url = new URL(c.req.url)
  const limitParam = Number(url.searchParams.get("limit") ?? 20)
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 50)
    : 20
  const beforeId = url.searchParams.get("before_id")

  let rows: Array<{
    id: string
    role: "user" | "agent"
    content: string
    created_at: number
    expression_group_id: string | null
    expression_part_index: number | null
  }>

  if (beforeId) {
    const cursor = await c.env.DB.prepare(
      "SELECT created_at AS createdAt, rowid AS rowId FROM chat_messages WHERE user_id = ? AND id = ?",
    )
      .bind(user.id, beforeId)
      .first<{
        createdAt: number
        rowId: number
      }>()

    if (!cursor) {
      return c.json(
        chatHistoryResponseSchema.parse({ messages: [], has_more: false }),
      )
    }

    rows = await c.env.DB.prepare(
      `SELECT
         id,
         role,
         content,
         created_at,
         expression_group_id,
         expression_part_index
       FROM chat_messages
       WHERE user_id = ?
         AND (created_at < ? OR (created_at = ? AND rowid < ?))
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`,
    )
      .bind(
        user.id,
        cursor.createdAt,
        cursor.createdAt,
        cursor.rowId,
        limit + 1,
      )
      .all<(typeof rows)[number]>()
      .then((result) => result.results ?? [])
  } else {
    rows = await c.env.DB.prepare(
      `SELECT
         id,
         role,
         content,
         created_at,
         expression_group_id,
         expression_part_index
       FROM chat_messages
       WHERE user_id = ?
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`,
    )
      .bind(user.id, limit + 1)
      .all<(typeof rows)[number]>()
      .then((result) => result.results ?? [])
  }

  const page = rows.slice(0, limit).reverse()
  return c.json(
    chatHistoryResponseSchema.parse({
      messages: page,
      has_more: rows.length > limit,
    }),
  )
})
