import {
  deleteChatMessageResponseSchema,
  chatHistoryResponseSchema,
  chatHistoryRequestSchema,
  chatConversationsResponseSchema,
  createChatConversationResponseSchema,
  createGroupChatRequestSchema,
  createSingleChatRequestSchema,
  relationshipResponseSchema,
} from "@ai-companion/shared"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"
import { ensureChatMessagesTable } from "@/chat/history"
import {
  createGroupChatConversation,
  createSingleChatConversation,
  getChatConversationList,
} from "@/chat/conversations"
import { getRelationshipState } from "@/agent/relationship/stateMachine"

export const chatRoutes = new Hono<AppBindings>()

chatRoutes.use("*", authMiddleware)

chatRoutes.get("/conversations", async (c) => {
  const user = c.get("user")
  const response = await getChatConversationList(c.env, user.id)
  return c.json(chatConversationsResponseSchema.parse(response))
})

chatRoutes.post("/conversations/single", async (c) => {
  const user = c.get("user")
  const input = createSingleChatRequestSchema.parse(await c.req.json())
  const response = await createSingleChatConversation(c.env, {
    userId: user.id,
    name: input.name,
    avatarUrl: input.avatar_url,
    personaPrompt: input.persona_prompt,
    copyPersonaPrompt: input.copy_persona_prompt,
  })
  return c.json(createChatConversationResponseSchema.parse(response), 201)
})

chatRoutes.post("/conversations/group", async (c) => {
  const user = c.get("user")
  const parsed = createGroupChatRequestSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    throw new HTTPException(400, { message: "至少选择两个 Agent" })
  }
  const input = parsed.data
  const response = await createGroupChatConversation(c.env, {
    userId: user.id,
    title: input.title,
    agentIds: input.agent_ids,
  })
  return c.json(createChatConversationResponseSchema.parse(response), 201)
})

export function createChatHistoryCursorQuery(input: {
  userId: string
  beforeId: string
  sessionId?: string
}) {
  if (input.sessionId) {
    return {
      sql: `SELECT created_at AS createdAt, rowid AS rowId
         FROM chat_messages
         WHERE user_id = ? AND conversation_id = ? AND id = ?`,
      values: [input.userId, input.sessionId, input.beforeId],
    }
  }
  return {
    sql: `SELECT created_at AS createdAt, rowid AS rowId
         FROM chat_messages
         WHERE user_id = ? AND id = ?`,
    values: [input.userId, input.beforeId],
  }
}

export function createChatHistoryPageQuery(input: {
  userId: string
  limit: number
  sessionId?: string
  cursor?: {
    createdAt: number
    rowId: number
  }
}) {
  if (input.cursor) {
    if (input.sessionId) {
      return {
        sql: `SELECT
           id,
           role,
           agent_id,
           agent_name,
           content,
           created_at,
           expression_group_id,
           expression_part_index
         FROM chat_messages
         WHERE user_id = ?
           AND conversation_id = ?
           AND (created_at < ? OR (created_at = ? AND rowid < ?))
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
        values: [
          input.userId,
          input.sessionId,
          input.cursor.createdAt,
          input.cursor.createdAt,
          input.cursor.rowId,
          input.limit + 1,
        ],
      }
    }
    return {
      sql: `SELECT
           id,
           role,
           agent_id,
           agent_name,
           content,
           created_at,
           expression_group_id,
           expression_part_index
         FROM chat_messages
         WHERE user_id = ?
           AND (created_at < ? OR (created_at = ? AND rowid < ?))
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      values: [
        input.userId,
        input.cursor.createdAt,
        input.cursor.createdAt,
        input.cursor.rowId,
        input.limit + 1,
      ],
    }
  }

  if (input.sessionId) {
    return {
      sql: `SELECT
           id,
           role,
           agent_id,
           agent_name,
           content,
           created_at,
           expression_group_id,
           expression_part_index
         FROM chat_messages
         WHERE user_id = ? AND conversation_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      values: [input.userId, input.sessionId, input.limit + 1],
    }
  }

  return {
    sql: `SELECT
           id,
           role,
           agent_id,
           agent_name,
           content,
           created_at,
           expression_group_id,
           expression_part_index
         FROM chat_messages
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
    values: [input.userId, input.limit + 1],
  }
}

chatRoutes.get("/history", async (c) => {
  const user = c.get("user")
  await ensureChatMessagesTable(c.env)
  const url = new URL(c.req.url)
  const query = chatHistoryRequestSchema.parse({
    before_id: url.searchParams.get("before_id") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    session_id: url.searchParams.get("session_id") ?? undefined,
  })
  const limit = query.limit
  const sessionId = query.session_id

  let rows: Array<{
    id: string
    role: "user" | "agent"
    agent_id: string | null
    agent_name: string | null
    content: string
    created_at: number
    expression_group_id: string | null
    expression_part_index: number | null
  }>

  if (query.before_id) {
    const cursorQuery = createChatHistoryCursorQuery({
      userId: user.id,
      beforeId: query.before_id,
      sessionId,
    })
    const cursor = await c.env.DB.prepare(cursorQuery.sql)
      .bind(...cursorQuery.values)
      .first<{
        createdAt: number
        rowId: number
      }>()

    if (!cursor) {
      return c.json(
        chatHistoryResponseSchema.parse({ messages: [], has_more: false }),
      )
    }

    const historyQuery = createChatHistoryPageQuery({
      userId: user.id,
      limit,
      sessionId,
      cursor,
    })
    rows = await c.env.DB.prepare(historyQuery.sql)
      .bind(...historyQuery.values)
      .all<(typeof rows)[number]>()
      .then((result) => result.results ?? [])
  } else {
    const historyQuery = createChatHistoryPageQuery({
      userId: user.id,
      limit,
      sessionId,
    })
    rows = await c.env.DB.prepare(historyQuery.sql)
      .bind(...historyQuery.values)
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

chatRoutes.delete("/history/:id", async (c) => {
  const user = c.get("user")
  await ensureChatMessagesTable(c.env)
  await c.env.DB.prepare("DELETE FROM chat_messages WHERE user_id = ? AND id = ?")
    .bind(user.id, c.req.param("id"))
    .run()
  return c.json(deleteChatMessageResponseSchema.parse({ ok: true }))
})

chatRoutes.get("/relationship", async (c) => {
  const user = c.get("user")
  const relationshipState = await getRelationshipState(c.env, user.id)
  return c.json(
    relationshipResponseSchema.parse({
      relationship_state: relationshipState,
    }),
  )
})
