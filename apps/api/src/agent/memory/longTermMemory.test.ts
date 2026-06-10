import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractLongTermMemory,
  formatLongTermMemory,
  heuristicExtractLongTermMemory,
  longTermMemoryCacheKey,
  loadLongTermMemory,
  maybeSaveConversationSummary,
  saveLongTermMemory,
} from "@/agent/memory/longTermMemory"
import { memoryTestCases } from "@/agent/memory/memoryTestCases"
import type { Env } from "@/env"

const blockingCaseIds = [
  "TC-MEMORY-01",
  "TC-MEMORY-02",
  "TC-MEMORY-03",
  "TC-SUPPORT-02",
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("long-term memory test cases", () => {
  it("contains the 12 converted test-set cases", () => {
    expect(memoryTestCases).toHaveLength(12)
  })

  it("keeps the required blocking cases explicit", () => {
    const actualBlockingIds = memoryTestCases
      .filter((testCase) => testCase.blocking)
      .map((testCase) => testCase.caseId)
      .sort()

    expect(actualBlockingIds).toEqual([...blockingCaseIds].sort())
  })

  it.each(memoryTestCases)(
    "has the required fixture shape for $caseId",
    (testCase) => {
      expect(testCase.caseId).toBeTruthy()
      expect(testCase.setup.profile).toBeTruthy()
      expect(testCase.setup.memories).toBeInstanceOf(Array)
      expect(testCase.input.messages.length).toBeGreaterThan(0)
      expect(testCase.assertions.mustSatisfy.length).toBeGreaterThan(0)
      expect(testCase.assertions.mustAvoid.length).toBeGreaterThan(0)
    },
  )

  for (const testCase of memoryTestCases) {
    it.todo(`${testCase.caseId} ${testCase.subcategory}`)
  }
})

type UserRow = {
  id: string
  long_term_memory_enabled: number
  deleted_at: number | null
}

type ProfileRow = {
  user_id: string
  name: string | null
  birthday: string | null
  occupation: string | null
  company: string | null
  location: string | null
  updated_at: number
}

type MemoryRow = {
  id: string
  user_id: string
  conversation_id: string
  type: string
  content: string
  created_at: number
}

type SummaryRow = {
  id: string
  user_id: string
  conversation_id: string
  summary: string
  start_time: number
  end_time: number
  message_count: number
  created_at: number
}

function createEnvFixture(input?: {
  memoryEnabled?: boolean
  profile?: Partial<ProfileRow>
  memories?: MemoryRow[]
  summaries?: SummaryRow[]
  cachedLongTermMemory?: unknown
}) {
  const users = new Map<string, UserRow>([
    [
      "u1",
      {
        id: "u1",
        long_term_memory_enabled: input?.memoryEnabled === false ? 0 : 1,
        deleted_at: null,
      },
    ],
  ])
  const profiles = new Map<string, ProfileRow>()
  if (input?.profile) {
    profiles.set("u1", {
      user_id: "u1",
      name: null,
      birthday: null,
      occupation: null,
      company: null,
      location: null,
      updated_at: 1,
      ...input.profile,
    })
  }
  const memories: MemoryRow[] = [...(input?.memories ?? [])]
  const summaries: SummaryRow[] = [...(input?.summaries ?? [])]
  const kv = new Map<string, string>()
  const vectors: Array<{
    id: string
    values: number[]
    namespace?: string
    metadata?: Record<string, unknown>
  }> = []
  if (input?.cachedLongTermMemory) {
    kv.set(
      longTermMemoryCacheKey("u1"),
      JSON.stringify(input.cachedLongTermMemory),
    )
  }

  const db = {
    readCount: 0,
    prepare(sql: string) {
      this.readCount +=
        sql.includes("FROM user_profiles") ||
        sql.includes("FROM memories") ||
        sql.includes("FROM conversation_summaries")
          ? 1
          : 0
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values
          return this
        },
        async first<T>() {
          if (sql.includes("long_term_memory_enabled")) {
            const user = users.get(String(this.values[0]))
            if (!user || user.deleted_at !== null) return null
            return { enabled: user.long_term_memory_enabled } as T
          }
          if (sql.includes("FROM user_profiles")) {
            const profile = profiles.get(String(this.values[0]))
            if (!profile) return null
            return {
              userId: profile.user_id,
              name: profile.name,
              birthday: profile.birthday,
              occupation: profile.occupation,
              company: profile.company,
              location: profile.location,
              updatedAt: profile.updated_at,
            } as T
          }
          if (sql.includes("FROM conversation_summaries")) {
            const userId = String(this.values[0])
            const conversationId = this.values[1]
              ? String(this.values[1])
              : null
            const summary = summaries
              .filter(
                (row) =>
                  row.user_id === userId &&
                  (!conversationId || row.conversation_id === conversationId),
              )
              .sort((a, b) => b.end_time - a.end_time)[0]
            return summary ? ({ endTime: summary.end_time } as T) : null
          }
          return null
        },
        async all<T>() {
          if (sql.includes("SELECT id FROM memories")) {
            const userId = String(this.values[0])
            const type = String(this.values[1])
            const results = memories
              .filter(
                (memory) => memory.user_id === userId && memory.type === type,
              )
              .map((memory) => ({ id: memory.id })) as T[]
            return { results }
          }
          if (sql.includes("FROM memories")) {
            const userId = String(this.values[0])
            const results = memories
              .filter((memory) => memory.user_id === userId)
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, 20)
              .map((memory) => ({
                type: memory.type,
                content: memory.content,
                createdAt: memory.created_at,
              })) as T[]
            return { results }
          }
          if (sql.includes("FROM conversation_summaries")) {
            const userId = String(this.values[0])
            const results = summaries
              .filter((summary) => summary.user_id === userId)
              .sort((a, b) => b.end_time - a.end_time)
              .slice(0, 3)
              .map((summary) => ({
                summary: summary.summary,
                startTime: summary.start_time,
                endTime: summary.end_time,
                messageCount: summary.message_count,
              })) as T[]
            return { results }
          }
          return { results: [] as T[] }
        },
        async run() {
          if (sql.includes("INSERT INTO user_profiles")) {
            const field = sql.match(
              /INSERT INTO user_profiles \(user_id, (\w+), updated_at\)/,
            )?.[1] as keyof ProfileRow
            const userId = String(this.values[0])
            const value = String(this.values[1])
            const updatedAt = Number(this.values[2])
            const current =
              profiles.get(userId) ??
              ({
                user_id: userId,
                name: null,
                birthday: null,
                occupation: null,
                company: null,
                location: null,
                updated_at: updatedAt,
              } satisfies ProfileRow)
            profiles.set(userId, {
              ...current,
              [field]: value,
              updated_at: updatedAt,
            })
          }
          if (sql.includes("INSERT INTO memories")) {
            memories.push({
              id: String(this.values[0]),
              user_id: String(this.values[1]),
              conversation_id: String(this.values[2]),
              type: String(this.values[3]),
              content: String(this.values[4]),
              created_at: Number(this.values[5]),
            })
          }
          if (sql.includes("DELETE FROM memories")) {
            const userId = String(this.values[0])
            const type = String(this.values[1])
            for (let index = memories.length - 1; index >= 0; index -= 1) {
              const memory = memories[index]
              if (memory.user_id === userId && memory.type === type) {
                memories.splice(index, 1)
              }
            }
          }
          if (sql.includes("INSERT INTO conversation_summaries")) {
            summaries.push({
              id: String(this.values[0]),
              user_id: String(this.values[1]),
              conversation_id: String(this.values[2]),
              summary: String(this.values[3]),
              start_time: Number(this.values[4]),
              end_time: Number(this.values[5]),
              message_count: Number(this.values[6]),
              created_at: Number(this.values[7]),
            })
          }
          return { success: true }
        },
      }
      return statement
    },
  }

  return {
    env: {
      DB: db,
      CHAT_CONTEXT: {
        async get(key: string) {
          return kv.get(key) ?? null
        },
        async put(key: string, value: string) {
          kv.set(key, value)
        },
        async delete(key: string) {
          kv.delete(key)
        },
      },
      MEMORY_VECTORIZE: {
        async upsert(items: typeof vectors) {
          vectors.push(...items)
        },
        async deleteByIds(ids: string[]) {
          for (const id of ids) {
            const index = vectors.findIndex((vector) => vector.id === id)
            if (index >= 0) vectors.splice(index, 1)
          }
        },
      },
      DEEPSEEK_API_KEY: "",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
      EMBEDDING_BASE_URL: "https://embedding.example.com",
      EMBEDDING_MODEL: "embedding-model",
      EMBEDDING_API_KEY: "embedding-key",
    } as unknown as Env,
    db,
    kv,
    vectors,
    profiles,
    memories,
    summaries,
  }
}

describe("long-term memory behavior", () => {
  it("loads profile and recent memory items for the agent prompt", async () => {
    const { env } = createEnvFixture({
      profile: { name: "小林", birthday: "09-17", occupation: "运营" },
      memories: [
        {
          id: "m1",
          user_id: "u1",
          conversation_id: "c1",
          type: "preference",
          content: "用户喜欢生日当天吃火锅",
          created_at: 10,
        },
      ],
    })

    const context = await loadLongTermMemory(env, "u1")
    const formatted = formatLongTermMemory(context)

    expect(context.enabled).toBe(true)
    expect(formatted).toContain("生日：09-17")
    expect(formatted).toContain("用户喜欢生日当天吃火锅")
  })

  it("uses KV as the hot cache before reading D1 long-term memory rows", async () => {
    const { env, db } = createEnvFixture({
      cachedLongTermMemory: {
        enabled: true,
        profile: {
          userId: "u1",
          name: "小林",
          birthday: "09-17",
          occupation: null,
          company: null,
          location: null,
          updatedAt: 1,
        },
        memories: [
          {
            type: "preference",
            content: "用户喜欢安静的回复",
            createdAt: 1,
          },
        ],
        summaries: [],
      },
    })

    const context = await loadLongTermMemory(env, "u1")

    expect(context.profile?.birthday).toBe("09-17")
    expect(context.memories[0].content).toContain("安静")
    expect(db.readCount).toBe(0)
  })

  it("stores D1 long-term memory results in KV after a cache miss", async () => {
    const { env, kv } = createEnvFixture({
      profile: { name: "小林", birthday: "09-17" },
      memories: [
        {
          id: "m1",
          user_id: "u1",
          conversation_id: "c1",
          type: "preference",
          content: "用户喜欢安静的回复",
          created_at: 10,
        },
      ],
      summaries: [
        {
          id: "s1",
          user_id: "u1",
          conversation_id: "c1",
          summary: "用户最近在聊生日安排",
          start_time: 1,
          end_time: 20,
          message_count: 20,
          created_at: 21,
        },
      ],
    })

    await loadLongTermMemory(env, "u1")

    const cached = kv.get(longTermMemoryCacheKey("u1"))
    expect(cached).toBeTruthy()
    expect(JSON.parse(cached ?? "{}")).toMatchObject({
      enabled: true,
      profile: { birthday: "09-17" },
      memories: [{ content: "用户喜欢安静的回复" }],
      summaries: [{ summary: "用户最近在聊生日安排" }],
    })
  })

  it("does not load or save when long-term memory is disabled", async () => {
    const { env, profiles, memories, kv } = createEnvFixture({
      memoryEnabled: false,
      cachedLongTermMemory: {
        enabled: true,
        profile: null,
        memories: [{ type: "preference", content: "不应读取", createdAt: 1 }],
        summaries: [],
      },
    })

    const context = await loadLongTermMemory(env, "u1")
    await saveLongTermMemory(env, {
      userId: "u1",
      conversationId: "c1",
      memory: {
        facts: [{ field: "birthday", value: "09-17" }],
        events: ["用户提到生日"],
        preferences: [],
        emotionSnapshot: null,
      },
    })

    expect(context).toEqual({
      enabled: false,
      profile: null,
      memories: [],
      summaries: [],
    })
    expect(profiles.size).toBe(0)
    expect(memories).toHaveLength(0)
    expect(kv.has(longTermMemoryCacheKey("u1"))).toBe(false)
  })

  it("overwrites profile facts and appends event memories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
            status: 200,
          }),
        ),
      ),
    )
    const { env, profiles, memories, kv, vectors } = createEnvFixture({
      profile: {
        occupation: "产品经理",
        company: "星河科技",
      },
      cachedLongTermMemory: {
        enabled: true,
        profile: null,
        memories: [{ type: "preference", content: "旧缓存", createdAt: 1 }],
        summaries: [],
      },
    })

    const extracted = heuristicExtractLongTermMemory("我下周开始去云杉做增长了")
    await saveLongTermMemory(env, {
      userId: "u1",
      conversationId: "c2",
      memory: extracted,
    })

    expect(profiles.get("u1")?.company).toBe("云杉")
    expect(profiles.get("u1")?.occupation).toBe("增长")
    expect(memories.some((memory) => memory.content.includes("云杉"))).toBe(
      true,
    )
    expect(kv.has(longTermMemoryCacheKey("u1"))).toBe(false)
    expect(
      vectors.some(
        (vector) => vector.metadata?.content === memories[0].content,
      ),
    ).toBe(true)
  })

  it("keeps only the latest memory for each type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
            status: 200,
          }),
        ),
      ),
    )
    const { env, memories } = createEnvFixture({
      memories: [
        {
          id: "old-event",
          user_id: "u1",
          conversation_id: "old-c1",
          type: "event",
          content: "用户之前提到旧事件",
          created_at: 1,
        },
        {
          id: "old-preference",
          user_id: "u1",
          conversation_id: "old-c2",
          type: "preference",
          content: "用户之前喜欢旧回复",
          created_at: 2,
        },
      ],
    })

    await saveLongTermMemory(env, {
      userId: "u1",
      conversationId: "c2",
      memory: {
        facts: [],
        events: ["用户提到第一个新事件", "用户提到最新事件"],
        preferences: ["用户喜欢更直接"],
        emotionSnapshot: "用户当前情绪状态：开心",
      },
    })

    expect(memories.map((memory) => memory.type).sort()).toEqual([
      "emotion_snapshot",
      "event",
      "preference",
    ])
    expect(memories.find((memory) => memory.type === "event")?.content).toBe(
      "用户提到最新事件",
    )
    expect(
      memories.find((memory) => memory.type === "preference")?.content,
    ).toBe("用户喜欢更直接")
  })

  it("does not keep assistant-sourced model output as memory", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/v1/chat/completions")) {
          return Promise.resolve(
            Response.json({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      facts: [],
                      events: ["助手建议用户每天冥想"],
                      preferences: ["用户喜欢喝乌龙茶"],
                      emotionSnapshot: "助手判断用户很焦虑",
                    }),
                  },
                },
              ],
            }),
          )
        }
        return Promise.resolve(Response.json({ data: [{ embedding: [0.1] }] }))
      }),
    )
    const { env } = createEnvFixture()
    env.DEEPSEEK_API_KEY = "deepseek-key"

    const memory = await extractLongTermMemory(env, {
      userMessage: "我喜欢喝乌龙茶",
      reply: "可以试试每天冥想",
      emotionState: "normal",
    })

    expect(memory.events).toEqual([])
    expect(memory.preferences).toContain("用户喜欢喝乌龙茶")
    expect(memory.emotionSnapshot).toBeNull()
  })

  it("extracts explicit preferences without external model calls", () => {
    const extracted = heuristicExtractLongTermMemory("我不喜欢太说教的回复")

    expect(extracted.preferences.join("\n")).toContain("不喜欢太说教")
  })

  it("does not turn questions about the assistant into user memories", async () => {
    const heuristic = heuristicExtractLongTermMemory("你喜欢喝什么？")
    const { env } = createEnvFixture()

    const extracted = await extractLongTermMemory(env, {
      userMessage: "你喜欢喝什么？",
      reply: "我喜欢暖暖的甜饮",
      emotionState: "normal",
    })

    expect(heuristic).toEqual({
      facts: [],
      events: [],
      preferences: [],
      emotionSnapshot: null,
    })
    expect(extracted).toEqual({
      facts: [],
      events: [],
      preferences: [],
      emotionSnapshot: null,
    })
  })

  it("writes a conversation summary after enough recent messages", async () => {
    const { env, summaries, kv } = createEnvFixture({
      cachedLongTermMemory: {
        enabled: true,
        profile: null,
        memories: [],
        summaries: [
          { summary: "旧摘要", startTime: 1, endTime: 2, messageCount: 2 },
        ],
      },
    })
    const messages = Array.from({ length: 20 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("agent" as const),
      content: index % 2 === 0 ? `用户话题 ${index}` : `回复 ${index}`,
      created_at: index + 1,
    }))

    await maybeSaveConversationSummary(env, {
      userId: "u1",
      conversationId: "c1",
      messages,
    })

    expect(summaries).toHaveLength(1)
    expect(summaries[0].summary).toContain("用户话题")
    expect(summaries[0].message_count).toBe(20)
    expect(kv.has(longTermMemoryCacheKey("u1"))).toBe(false)
  })
})
