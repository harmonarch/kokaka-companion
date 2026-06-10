import { describe, expect, it, vi } from "vitest"
import { memoryRoutes } from "@/routes/memories"
import { longTermMemoryCacheKey } from "@/agent/memory/longTermMemory"
import type { Env } from "@/env"

vi.mock("@/auth/session", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    id: "u1",
    email: "u1@example.com",
    nickname: "小林",
  }),
}))

type MemoryFixture = {
  id: string
  user_id: string
  conversation_id: string | null
  type: "event" | "preference" | "emotion_snapshot"
  content: string
  created_at: number
}

type ChatMessageFixture = {
  id: string
  user_id: string
  conversation_id: string
  role: "user" | "agent"
  content: string
  created_at: number
}

function createEnvFixture() {
  const memories: MemoryFixture[] = [
    {
      id: "m1",
      user_id: "u1",
      conversation_id: "c1",
      type: "preference",
      content: "用户喜欢安静的回复",
      created_at: 10,
    },
    {
      id: "m2",
      user_id: "u1",
      conversation_id: "c2",
      type: "event",
      content: "用户今天完成了重构",
      created_at: 20,
    },
    {
      id: "other",
      user_id: "u2",
      conversation_id: "c3",
      type: "preference",
      content: "其他用户的记忆",
      created_at: 30,
    },
  ]
  const chatMessages: ChatMessageFixture[] = [
    {
      id: "c2-1",
      user_id: "u1",
      conversation_id: "c2",
      role: "user",
      content: "前面的消息",
      created_at: 11,
    },
    {
      id: "c2-2",
      user_id: "u1",
      conversation_id: "c2",
      role: "agent",
      content: "前面的回复",
      created_at: 12,
    },
    {
      id: "c2-3",
      user_id: "u1",
      conversation_id: "c2",
      role: "user",
      content: "我今天准备重构 mobile",
      created_at: 13,
    },
    {
      id: "c2-4",
      user_id: "u1",
      conversation_id: "c2",
      role: "agent",
      content: "可以先拆页面逻辑",
      created_at: 14,
    },
    {
      id: "c2-5",
      user_id: "u1",
      conversation_id: "c2",
      role: "user",
      content: "我已经完成了重构",
      created_at: 15,
    },
    {
      id: "c2-6",
      user_id: "u1",
      conversation_id: "c2",
      role: "agent",
      content: "这个进展很好",
      created_at: 16,
    },
    {
      id: "c2-7",
      user_id: "u1",
      conversation_id: "c2",
      role: "user",
      content: "我想把它记下来",
      created_at: 17,
    },
    {
      id: "c2-8",
      user_id: "u1",
      conversation_id: "c2",
      role: "agent",
      content: "已经记下来了",
      created_at: 18,
    },
    {
      id: "c2-later",
      user_id: "u1",
      conversation_id: "c2",
      role: "user",
      content: "之后才发送的消息",
      created_at: 21,
    },
    {
      id: "other-message",
      user_id: "u2",
      conversation_id: "c2",
      role: "user",
      content: "其他用户消息",
      created_at: 17,
    },
  ]
  const deletedKeys: string[] = []
  const upsertedVectors: unknown[] = []
  const deletedVectorIds: string[] = []

  const db = {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          this.args = args
          return this
        },
        async all() {
          if (sql.includes("FROM chat_messages")) {
            const [userId, conversationId, createdAt] = this.args as [
              string,
              string,
              number,
            ]
            return {
              results: chatMessages
                .filter(
                  (message) =>
                    message.user_id === userId &&
                    message.conversation_id === conversationId &&
                    message.created_at <= createdAt,
                )
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 6),
            }
          }
          const [userId] = this.args as [string]
          return {
            results: memories
              .filter((memory) => memory.user_id === userId)
              .sort((a, b) => b.created_at - a.created_at),
          }
        },
        async first() {
          const [userId, id] = this.args as [string, string]
          return (
            memories.find(
              (memory) => memory.user_id === userId && memory.id === id,
            ) ?? null
          )
        },
        async run() {
          if (sql.startsWith("UPDATE memories")) {
            const [content, userId, id] = this.args as [string, string, string]
            const memory = memories.find(
              (item) => item.user_id === userId && item.id === id,
            )
            if (memory) memory.content = content
            return { success: true, meta: { changes: memory ? 1 : 0 } }
          }
          if (sql.startsWith("DELETE FROM memories")) {
            const [userId, id] = this.args as [string, string]
            const index = memories.findIndex(
              (memory) => memory.user_id === userId && memory.id === id,
            )
            if (index >= 0) {
              memories.splice(index, 1)
            }
            return { success: true, meta: { changes: index >= 0 ? 1 : 0 } }
          }
          return { success: true, meta: { changes: 0 } }
        },
      }
      return statement
    },
  }

  const env = {
    DB: db,
    CHAT_CONTEXT: {
      async delete(key: string) {
        deletedKeys.push(key)
      },
    },
    MEMORY_VECTORIZE: {
      async upsert(items: unknown[]) {
        upsertedVectors.push(...items)
      },
      async deleteByIds(ids: string[]) {
        deletedVectorIds.push(...ids)
      },
    },
    EMBEDDING_BASE_URL: "https://embedding.example.com",
    EMBEDDING_MODEL: "embedding-model",
    EMBEDDING_API_KEY: "embedding-key",
  } as unknown as Env

  return {
    env,
    memories,
    chatMessages,
    deletedKeys,
    upsertedVectors,
    deletedVectorIds,
  }
}

describe("memory routes", () => {
  it("lists only the current user's memories", async () => {
    const { env } = createEnvFixture()
    const response = await memoryRoutes.request(
      new Request("http://localhost/", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      memories: [
        {
          id: "m2",
          type: "event",
          content: "用户今天完成了重构",
          created_at: 20,
        },
        {
          id: "m1",
          type: "preference",
          content: "用户喜欢安静的回复",
          created_at: 10,
        },
      ],
    })
  })

  it("updates a memory and clears the long-term memory cache", async () => {
    const { env, memories, deletedKeys, upsertedVectors } = createEnvFixture()
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    )
    const response = await memoryRoutes.request(
      new Request("http://localhost/m1", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ content: "用户喜欢更直接的回复" }),
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: "m1",
      type: "preference",
      content: "用户喜欢更直接的回复",
      created_at: 10,
    })
    expect(memories.find((memory) => memory.id === "m1")?.content).toBe(
      "用户喜欢更直接的回复",
    )
    expect(deletedKeys).toEqual([longTermMemoryCacheKey("u1")])
    expect(upsertedVectors).toHaveLength(1)
  })

  it("returns the latest three turns for a memory conversation", async () => {
    const { env } = createEnvFixture()
    const response = await memoryRoutes.request(
      new Request("http://localhost/m2/context", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      messages: [
        {
          id: "c2-3",
          role: "user",
          content: "我今天准备重构 mobile",
          created_at: 13,
        },
        {
          id: "c2-4",
          role: "agent",
          content: "可以先拆页面逻辑",
          created_at: 14,
        },
        {
          id: "c2-5",
          role: "user",
          content: "我已经完成了重构",
          created_at: 15,
        },
        {
          id: "c2-6",
          role: "agent",
          content: "这个进展很好",
          created_at: 16,
        },
        {
          id: "c2-7",
          role: "user",
          content: "我想把它记下来",
          created_at: 17,
        },
        {
          id: "c2-8",
          role: "agent",
          content: "已经记下来了",
          created_at: 18,
        },
      ],
    })
  })

  it("does not expose another user's memory context", async () => {
    const { env } = createEnvFixture()
    const response = await memoryRoutes.request(
      new Request("http://localhost/other/context", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(404)
  })

  it("deletes a memory and keeps other users' memories", async () => {
    const { env, memories, deletedKeys, deletedVectorIds } = createEnvFixture()
    const response = await memoryRoutes.request(
      new Request("http://localhost/m2", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(memories.map((memory) => memory.id)).toEqual(["m1", "other"])
    expect(deletedKeys).toEqual([longTermMemoryCacheKey("u1")])
    expect(deletedVectorIds).toEqual(["m2"])
  })
})
