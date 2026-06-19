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
  content: string
  created_at: number
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
                .filter((conversation) => conversation.user_id === userId)
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
          if (sql.includes("FROM chat_messages")) {
            const [userId] = this.args as [string]
            const latestByConversation = new Map<string, ChatMessageRow>()
            for (const message of chatMessages.filter(
              (item) => item.user_id === userId,
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
          return { results: [] as T[] }
        },
        async run() {
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
              })
            }
          }
          if (sql.includes("UPDATE chat_conversations")) {
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
})
