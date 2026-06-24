import { describe, expect, it, vi } from "vitest"
import type {
  ChatConversationsResponse,
  CreateChatConversationResponse,
} from "@ai-companion/shared"
import {
  createChatHistoryCursorQuery,
  createChatHistoryPageQuery,
  chatRoutes,
} from "@/routes/chat"
import type { Env } from "@/env"

vi.mock("@/auth/session", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    id: "u1",
    email: "u1@example.com",
    nickname: "小林",
  }),
}))

type AgentRow = {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  persona_prompt: string
  created_at: number
  updated_at: number
}

type ConversationRow = {
  id: string
  user_id: string
  type: "single" | "group"
  title: string
  last_message: string
  created_at: number
  updated_at: number
  pinned_at: number | null
  deleted_at: number | null
}

type ConversationAgentRow = {
  user_id: string
  conversation_id: string
  agent_id: string
  position: number
}

type ChatProfileRow = {
  user_id: string
  role: "user" | "agent"
  nickname: string | null
  avatar_url: string | null
}

type ChatMessageRow = {
  id: string
  user_id: string
  conversation_id: string
  role: "user" | "agent"
  agent_id?: string | null
  agent_name?: string | null
  content: string
  created_at: number
  expression_group_id?: string | null
  expression_part_index?: number | null
}

function createEnvFixture() {
  const agents: AgentRow[] = []
  const conversations: ConversationRow[] = []
  const conversationAgents: ConversationAgentRow[] = []
  const chatProfiles: ChatProfileRow[] = [
    {
      user_id: "u1",
      role: "user",
      nickname: "我",
      avatar_url: "data:image/png;base64,bbbb",
    },
    {
      user_id: "u1",
      role: "agent",
      nickname: "小练",
      avatar_url: "data:image/png;base64,aaaa",
    },
  ]
  const chatMessages: ChatMessageRow[] = []

  const db = {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          this.args = args
          return this
        },
        async first<T>() {
          if (sql.includes("FROM chat_profiles")) {
            const [userId] = this.args as [string]
            const role = sql.includes("role = 'user'") ? "user" : "agent"
            return (chatProfiles.find(
              (profile) => profile.user_id === userId && profile.role === role,
            ) ?? null) as T | null
          }
          if (sql.includes("FROM chat_agents")) {
            const [userId, agentId] = this.args as [string, string]
            return (agents.find(
              (agent) => agent.user_id === userId && agent.id === agentId,
            ) ?? null) as T | null
          }
          if (sql.includes("FROM chat_conversations")) {
            if (sql.includes("deleted_at IS NOT NULL")) {
              const [userId, id] = this.args as [string, string]
              return (conversations.find(
                (conversation) =>
                  conversation.user_id === userId &&
                  conversation.id === id &&
                  conversation.deleted_at !== null,
              ) ?? null) as T | null
            }
          }
          if (sql.includes("FROM chat_messages")) {
            const args = this.args as unknown[]
            const userId = args[0] as string
            const messageId = args.at(-1) as string
            const message = chatMessages.find(
              (item) => item.user_id === userId && item.id === messageId,
            )
            if (!message) return null
            return {
              createdAt: message.created_at,
              rowId: chatMessages.indexOf(message) + 1,
            } as T
          }
          return null
        },
        async all<T>() {
          if (sql.includes("PRAGMA table_info")) {
            return {
              results: [
                { name: "id" },
                { name: "user_id" },
                { name: "conversation_id" },
                { name: "role" },
                { name: "content" },
                { name: "created_at" },
                { name: "pinned_at" },
                { name: "deleted_at" },
                { name: "expression_group_id" },
                { name: "expression_part_index" },
              ],
            }
          }
          if (sql.includes("FROM chat_agents") && sql.includes("id IN")) {
            const [userId, ...agentIds] = this.args as string[]
            return {
              results: agentIds
                .map((agentId) =>
                  agents.find(
                    (agent) => agent.user_id === userId && agent.id === agentId,
                  ),
                )
                .filter(Boolean),
            } as { results: T[] }
          }
          if (sql.includes("FROM chat_agents")) {
            const [userId] = this.args as [string]
            return {
              results: agents.filter((agent) => agent.user_id === userId),
            } as { results: T[] }
          }
          if (sql.includes("FROM chat_conversations")) {
            const [userId] = this.args as [string]
            return {
              results: conversations
                .filter(
                  (conversation) =>
                    conversation.user_id === userId &&
                    conversation.deleted_at === null,
                )
                .sort((a, b) => b.updated_at - a.updated_at),
            } as { results: T[] }
          }
          if (sql.includes("FROM chat_conversation_agents")) {
            const [userId] = this.args as [string]
            return {
              results: conversationAgents
                .filter((link) => link.user_id === userId)
                .sort((a, b) => a.position - b.position),
            } as { results: T[] }
          }
          if (sql.includes("ROW_NUMBER() OVER")) {
            const [userId] = this.args as [string]
            const latestByConversation = new Map<string, ChatMessageRow>()
            const visibleConversationIds = new Set(
              conversations
                .filter(
                  (conversation) =>
                    conversation.user_id === userId &&
                    conversation.deleted_at === null,
                )
                .map((conversation) => conversation.id),
            )
            for (const message of chatMessages.filter(
              (item) =>
                item.user_id === userId &&
                visibleConversationIds.has(item.conversation_id),
            )) {
              const existing = latestByConversation.get(message.conversation_id)
              if (!existing || message.created_at >= existing.created_at) {
                latestByConversation.set(message.conversation_id, message)
              }
            }
            return {
              results: [...latestByConversation.values()].map((message) => ({
                conversation_id: message.conversation_id,
                content: message.content,
                created_at: message.created_at,
              })),
            } as { results: T[] }
          }
          if (sql.includes("FROM chat_messages")) {
            const [userId, second, third, fourth, fifth, sixth] = this
              .args as [string, string | number | undefined, ...number[]]
            const hasConversationFilter = sql.includes("conversation_id = ?")
            const conversationId =
              hasConversationFilter && typeof second === "string"
                ? second
                : null
            const limit = Number(
              hasConversationFilter
                ? fourth === undefined
                  ? third
                  : sixth
                : third === undefined
                  ? second
                  : fifth,
            )
            const cursorCreatedAt = hasConversationFilter ? third : second
            const cursorRowId = hasConversationFilter ? fourth : third
            const rows = chatMessages
              .map((message, index) => ({ message, rowId: index + 1 }))
              .filter(({ message, rowId }) => {
                if (message.user_id !== userId) return false
                if (conversationId && message.conversation_id !== conversationId) {
                  return false
                }
                if (
                  typeof cursorCreatedAt === "number" &&
                  typeof cursorRowId === "number"
                ) {
                  return (
                    message.created_at < cursorCreatedAt ||
                    (message.created_at === cursorCreatedAt &&
                      rowId < cursorRowId)
                  )
                }
                return true
              })
              .sort((a, b) => {
                if (a.message.created_at !== b.message.created_at) {
                  return b.message.created_at - a.message.created_at
                }
                return b.rowId - a.rowId
              })
              .slice(0, limit)
              .map(({ message }) => ({
                id: message.id,
                role: message.role,
                agent_id: message.agent_id ?? null,
                agent_name: message.agent_name ?? null,
                content: message.content,
                created_at: message.created_at,
                expression_group_id: message.expression_group_id ?? null,
                expression_part_index: message.expression_part_index ?? null,
              }))
            return { results: rows } as { results: T[] }
          }
          return { results: [] as T[] }
        },
        async run() {
          if (sql.includes("DELETE FROM chat_messages")) {
            const [userId, id] = this.args as [string, string]
            for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
              const message = chatMessages[index]
              if (!message || message.user_id !== userId) continue
              const matches = sql.includes("conversation_id = ?")
                ? message.conversation_id === id
                : message.id === id
              if (matches) chatMessages.splice(index, 1)
            }
          }
          if (sql.includes("INSERT OR IGNORE INTO chat_agents")) {
            const [
              id,
              userId,
              name,
              avatarUrl,
              personaPrompt,
              createdAt,
              updatedAt,
            ] = this.args as [
              string,
              string,
              string,
              string | null,
              string,
              number,
              number,
            ]
            if (
              !agents.some(
                (agent) => agent.user_id === userId && agent.id === id,
              )
            ) {
              agents.push({
                id,
                user_id: userId,
                name,
                avatar_url: avatarUrl,
                persona_prompt: personaPrompt,
                created_at: createdAt,
                updated_at: updatedAt,
              })
            }
          }
          if (sql.includes("UPDATE chat_agents")) {
            const [name, avatarUrl, updatedAt, id, userId] = this.args as [
              string,
              string | null,
              number,
              string,
              string,
            ]
            const agent = agents.find(
              (item) =>
                item.user_id === userId &&
                item.id === id &&
                item.created_at === 1,
            )
            if (agent) {
              agent.name = name
              agent.avatar_url = avatarUrl
              agent.updated_at = updatedAt
            }
          }
          if (sql.includes("INSERT OR IGNORE INTO chat_conversations")) {
            const [id, userId, title, lastMessage, createdAt, updatedAt] = this
              .args as [string, string, string, string, number, number]
            if (
              !conversations.some(
                (conversation) =>
                  conversation.user_id === userId && conversation.id === id,
              )
            ) {
              conversations.push({
                id,
                user_id: userId,
                type: "single",
                title,
                last_message: lastMessage,
                created_at: createdAt,
                updated_at: updatedAt,
                pinned_at: null,
                deleted_at: null,
              })
            }
          }
          if (sql.includes("UPDATE chat_conversations")) {
            if (sql.includes("SET pinned_at = ?")) {
              const [pinnedAt, userId, id] = this.args as [
                number,
                string,
                string,
              ]
              const conversation = conversations.find(
                (item) =>
                  item.user_id === userId &&
                  item.id === id &&
                  item.deleted_at === null,
              )
              if (conversation) conversation.pinned_at = pinnedAt
              return { success: true }
            }
            if (sql.includes("SET pinned_at = NULL")) {
              const [userId, id] = this.args as [string, string]
              const conversation = conversations.find(
                (item) =>
                  item.user_id === userId &&
                  item.id === id &&
                  item.deleted_at === null,
              )
              if (conversation) conversation.pinned_at = null
              return { success: true }
            }
            if (sql.includes("SET deleted_at = ?")) {
              const [deletedAt, userId, id] = this.args as [
                number,
                string,
                string,
              ]
              const conversation = conversations.find(
                (item) =>
                  item.user_id === userId &&
                  item.id === id &&
                  item.deleted_at === null,
              )
              if (conversation) {
                conversation.deleted_at = deletedAt
                conversation.pinned_at = null
              }
              return { success: true }
            }
            const [title, id, userId] = this.args as [string, string, string]
            const conversation = conversations.find(
              (item) =>
                item.user_id === userId &&
                item.id === id &&
                item.created_at === 1,
            )
            if (conversation) conversation.title = title
          }
          if (sql.includes("INSERT INTO chat_agents")) {
            const [
              id,
              userId,
              name,
              avatarUrl,
              personaPrompt,
              createdAt,
              updatedAt,
            ] = this.args as [
              string,
              string,
              string,
              string | null,
              string,
              number,
              number,
            ]
            agents.push({
              id,
              user_id: userId,
              name,
              avatar_url: avatarUrl,
              persona_prompt: personaPrompt,
              created_at: createdAt,
              updated_at: updatedAt,
            })
          }
          if (sql.includes("INSERT INTO chat_conversations")) {
            const [id, userId, type, title, lastMessage, createdAt, updatedAt] =
              this.args as [
                string,
                string,
                "single" | "group",
                string,
                string,
                number,
                number,
              ]
            conversations.push({
              id,
              user_id: userId,
              type,
              title,
              last_message: lastMessage,
              created_at: createdAt,
              updated_at: updatedAt,
              pinned_at: null,
              deleted_at: null,
            })
          }
          if (sql.includes("INSERT OR IGNORE INTO chat_conversation_agents")) {
            const [userId, conversationId, agentId] = this.args as [
              string,
              string,
              string,
            ]
            if (
              !conversationAgents.some(
                (link) =>
                  link.user_id === userId &&
                  link.conversation_id === conversationId &&
                  link.agent_id === agentId,
              )
            ) {
              conversationAgents.push({
                user_id: userId,
                conversation_id: conversationId,
                agent_id: agentId,
                position: 0,
              })
            }
          }
          if (sql.includes("INSERT INTO chat_conversation_agents")) {
            const [userId, conversationId, agentId, position] = this.args as [
              string,
              string,
              string,
              number,
            ]
            conversationAgents.push({
              user_id: userId,
              conversation_id: conversationId,
              agent_id: agentId,
              position,
            })
          }
          return { success: true }
        },
      }
      return statement
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) {
        await statement.run()
      }
    },
  }

  return {
    env: { DB: db } as unknown as Env,
    agents,
    conversations,
    conversationAgents,
    chatMessages,
  }
}

describe("chat history route queries", () => {
  it("filters the first history page by session id", () => {
    const query = createChatHistoryPageQuery({
      userId: "u1",
      sessionId: "chat:agent-1",
      limit: 20,
    })

    expect(query.sql).toContain("conversation_id = ?")
    expect(query.values).toEqual(["u1", "chat:agent-1", 21])
  })

  it("filters cursor lookup and older history by session id", () => {
    const cursor = createChatHistoryCursorQuery({
      userId: "u1",
      sessionId: "group-1",
      beforeId: "m2",
    })
    const page = createChatHistoryPageQuery({
      userId: "u1",
      sessionId: "group-1",
      limit: 20,
      cursor: {
        createdAt: 10,
        rowId: 3,
      },
    })

    expect(cursor.sql).toContain("conversation_id = ?")
    expect(cursor.values).toEqual(["u1", "group-1", "m2"])
    expect(page.sql).toContain("conversation_id = ?")
    expect(page.values).toEqual(["u1", "group-1", 10, 10, 3, 21])
  })
})

describe("chat history delete route", () => {
  it("deletes the current user's user messages", async () => {
    const { env, chatMessages } = createEnvFixture()
    chatMessages.push(
      {
        id: "u-message",
        user_id: "u1",
        conversation_id: "default",
        role: "user",
        content: "要删除的用户消息",
        created_at: 10,
      },
      {
        id: "keep-agent",
        user_id: "u1",
        conversation_id: "default",
        role: "agent",
        content: "保留的回复",
        created_at: 11,
      },
    )

    const response = await chatRoutes.request(
      new Request("http://localhost/history/u-message", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(chatMessages.map((message) => message.id)).toEqual(["keep-agent"])
  })

  it("deletes the current user's agent messages", async () => {
    const { env, chatMessages } = createEnvFixture()
    chatMessages.push({
      id: "agent-message",
      user_id: "u1",
      conversation_id: "default",
      role: "agent",
      agent_id: "agent:xiaolian",
      agent_name: "小练",
      content: "要删除的 Agent 消息",
      created_at: 10,
    })

    const response = await chatRoutes.request(
      new Request("http://localhost/history/agent-message", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(chatMessages).toHaveLength(0)
  })

  it("treats missing messages as deleted", async () => {
    const { env, chatMessages } = createEnvFixture()

    const response = await chatRoutes.request(
      new Request("http://localhost/history/missing", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(chatMessages).toEqual([])
  })

  it("does not delete another user's messages", async () => {
    const { env, chatMessages } = createEnvFixture()
    chatMessages.push({
      id: "other-message",
      user_id: "u2",
      conversation_id: "default",
      role: "agent",
      content: "其他用户的消息",
      created_at: 10,
    })

    const response = await chatRoutes.request(
      new Request("http://localhost/history/other-message", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(chatMessages.map((message) => message.id)).toEqual([
      "other-message",
    ])
  })

  it("keeps deleted messages out of history", async () => {
    const { env, chatMessages } = createEnvFixture()
    chatMessages.push(
      {
        id: "deleted-message",
        user_id: "u1",
        conversation_id: "default",
        role: "user",
        content: "删除后不应返回",
        created_at: 10,
      },
      {
        id: "visible-message",
        user_id: "u1",
        conversation_id: "default",
        role: "agent",
        content: "还在",
        created_at: 11,
      },
    )

    await chatRoutes.request(
      new Request("http://localhost/history/deleted-message", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const historyResponse = await chatRoutes.request(
      new Request("http://localhost/history?session_id=default", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const history = (await historyResponse.json()) as {
      messages: Array<{ id: string }>
    }

    expect(history.messages.map((message: { id: string }) => message.id)).toEqual(
      ["visible-message"],
    )
  })
})

describe("chat conversation routes", () => {
  it("returns a default conversation with the current agent avatar", async () => {
    const { env } = createEnvFixture()

    const response = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      user: {
        nickname: "我",
        avatar_url: "data:image/png;base64,bbbb",
      },
      agents: [
        {
          id: "agent:xiaolian",
          name: "小练",
          avatar_url: "data:image/png;base64,aaaa",
          persona_prompt: "温柔地陪我整理情绪",
        },
      ],
      conversations: [
        {
          id: "default",
          type: "single",
          title: "小练",
          agent_ids: ["agent:xiaolian"],
          pinned_at: null,
        },
      ],
    })
  })

  it("creates a single chat agent and returns it in the list", async () => {
    const { env } = createEnvFixture()
    const avatar = "data:image/png;base64,cccc"

    const createResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "安安",
          avatar_url: avatar,
          persona_prompt: "提醒我慢一点说",
        }),
      }),
      undefined,
      env,
    )

    expect(createResponse.status).toBe(201)
    const created =
      (await createResponse.json()) as CreateChatConversationResponse
    expect(created).toMatchObject({
      conversation: {
        type: "single",
        title: "安安",
        last_message: "提醒我慢一点说",
      },
      agent: {
        name: "安安",
        avatar_url: avatar,
        persona_prompt: "提醒我慢一点说",
      },
    })
    expect(created.agent).toBeDefined()
    const createdAgent = created.agent!

    const listResponse = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const list = (await listResponse.json()) as ChatConversationsResponse
    expect(list.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdAgent.id,
          name: "安安",
          avatar_url: avatar,
        }),
      ]),
    )
    expect(list.conversations[0]).toMatchObject({
      id: created.conversation.id,
      type: "single",
      title: "安安",
      agent_ids: [createdAgent.id],
    })
  })

  it("creates a group chat from selected agents", async () => {
    const { env } = createEnvFixture()
    const firstResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "安安",
          persona_prompt: "提醒我慢一点说",
        }),
      }),
      undefined,
      env,
    )
    const first = (await firstResponse.json()) as CreateChatConversationResponse
    expect(first.agent).toBeDefined()
    const firstAgent = first.agent!
    const secondResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "晴晴",
          copy_persona_prompt: true,
        }),
      }),
      undefined,
      env,
    )
    const second =
      (await secondResponse.json()) as CreateChatConversationResponse
    expect(second.agent).toBeDefined()
    const secondAgent = second.agent!

    const groupResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/group", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "周末计划",
          agent_ids: [secondAgent.id, firstAgent.id],
        }),
      }),
      undefined,
      env,
    )

    expect(groupResponse.status).toBe(201)
    expect(await groupResponse.json()).toMatchObject({
      conversation: {
        type: "group",
        title: "周末计划",
        agent_ids: [secondAgent.id, firstAgent.id],
        last_message: "群聊已创建",
      },
    })
  })

  it("rejects group chat with fewer than two agents", async () => {
    const { env } = createEnvFixture()
    const firstResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "安安",
          persona_prompt: "提醒我慢一点说",
        }),
      }),
      undefined,
      env,
    )
    const first = (await firstResponse.json()) as CreateChatConversationResponse
    expect(first.agent).toBeDefined()

    const groupResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/group", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "只有一个 Agent",
          agent_ids: [first.agent!.id],
        }),
      }),
      undefined,
      env,
    )

    expect(groupResponse.status).toBe(400)
  })

  it("sorts pinned conversations before unpinned conversations", async () => {
    const { env } = createEnvFixture()
    const firstResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "安安" }),
      }),
      undefined,
      env,
    )
    const first = (await firstResponse.json()) as CreateChatConversationResponse
    const secondResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "晴晴" }),
      }),
      undefined,
      env,
    )
    const second =
      (await secondResponse.json()) as CreateChatConversationResponse

    const pinResponse = await chatRoutes.request(
      new Request(`http://localhost/conversations/${first.conversation.id}/pin`, {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    expect(pinResponse.status).toBe(200)

    const listResponse = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const list = (await listResponse.json()) as ChatConversationsResponse

    expect(list.conversations[0]?.id).toBe(first.conversation.id)
    expect(list.conversations[0]?.pinned_at).toEqual(expect.any(Number))
    expect(list.conversations[1]?.id).toBe(second.conversation.id)
  })

  it("restores normal ordering after unpinning a conversation", async () => {
    const { env } = createEnvFixture()
    const firstResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "安安" }),
      }),
      undefined,
      env,
    )
    const first = (await firstResponse.json()) as CreateChatConversationResponse
    const secondResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "晴晴" }),
      }),
      undefined,
      env,
    )
    const second =
      (await secondResponse.json()) as CreateChatConversationResponse

    await chatRoutes.request(
      new Request(`http://localhost/conversations/${first.conversation.id}/pin`, {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const unpinResponse = await chatRoutes.request(
      new Request(
        `http://localhost/conversations/${first.conversation.id}/unpin`,
        {
          method: "POST",
          headers: { authorization: "Bearer token" },
        },
      ),
      undefined,
      env,
    )
    expect(unpinResponse.status).toBe(200)

    const listResponse = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const list = (await listResponse.json()) as ChatConversationsResponse

    expect(list.conversations.find(
      (conversation) => conversation.id === second.conversation.id,
    )).toBeDefined()
    expect(list.conversations.find(
      (conversation) => conversation.id === first.conversation.id,
    )?.pinned_at).toBeNull()
  })

  it("deletes a conversation and its history", async () => {
    const { env, chatMessages } = createEnvFixture()
    const createResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/single", {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "安安" }),
      }),
      undefined,
      env,
    )
    const created =
      (await createResponse.json()) as CreateChatConversationResponse
    chatMessages.push(
      {
        id: "delete-me",
        user_id: "u1",
        conversation_id: created.conversation.id,
        role: "user",
        content: "要删除",
        created_at: 10,
      },
      {
        id: "keep-me",
        user_id: "u1",
        conversation_id: "default",
        role: "user",
        content: "保留",
        created_at: 11,
      },
    )

    const deleteResponse = await chatRoutes.request(
      new Request(
        `http://localhost/conversations/${created.conversation.id}`,
        {
          method: "DELETE",
          headers: { authorization: "Bearer token" },
        },
      ),
      undefined,
      env,
    )
    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toEqual({ ok: true })

    const listResponse = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const list = (await listResponse.json()) as ChatConversationsResponse
    expect(list.conversations.some(
      (conversation) => conversation.id === created.conversation.id,
    )).toBe(false)
    expect(chatMessages.map((message) => message.id)).toEqual(["keep-me"])
  })

  it("keeps a deleted default conversation out of future lists", async () => {
    const { env } = createEnvFixture()

    const deleteResponse = await chatRoutes.request(
      new Request("http://localhost/conversations/default", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    expect(deleteResponse.status).toBe(200)

    const listResponse = await chatRoutes.request(
      new Request("http://localhost/conversations", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )
    const list = (await listResponse.json()) as ChatConversationsResponse

    expect(list.conversations).toEqual([])
  })

  it("does not delete another user's conversation", async () => {
    const { env, conversations, chatMessages } = createEnvFixture()
    conversations.push({
      id: "other-chat",
      user_id: "u2",
      type: "single",
      title: "其他用户",
      last_message: "保留",
      created_at: 10,
      updated_at: 10,
      pinned_at: null,
      deleted_at: null,
    })
    chatMessages.push({
      id: "other-chat-message",
      user_id: "u2",
      conversation_id: "other-chat",
      role: "user",
      content: "不能删除",
      created_at: 10,
    })

    const response = await chatRoutes.request(
      new Request("http://localhost/conversations/other-chat", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(conversations.find(
      (conversation) => conversation.id === "other-chat",
    )?.deleted_at).toBeNull()
    expect(chatMessages.map((message) => message.id)).toEqual([
      "other-chat-message",
    ])
  })

  it("returns 404 when pinning a missing conversation", async () => {
    const { env } = createEnvFixture()

    const response = await chatRoutes.request(
      new Request("http://localhost/conversations/missing/pin", {
        method: "POST",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(404)
  })
})
