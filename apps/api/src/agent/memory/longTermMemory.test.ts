import { describe, expect, it } from "vitest"
import {
  formatLongTermMemory,
  heuristicExtractLongTermMemory,
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

  const db = {
    prepare(sql: string) {
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
      DEEPSEEK_API_KEY: "",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
    } as unknown as Env,
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

  it("does not load or save when long-term memory is disabled", async () => {
    const { env, profiles, memories } = createEnvFixture({
      memoryEnabled: false,
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
  })

  it("overwrites profile facts and appends event memories", async () => {
    const { env, profiles, memories } = createEnvFixture({
      profile: {
        occupation: "产品经理",
        company: "星河科技",
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
  })

  it("extracts explicit preferences without external model calls", () => {
    const extracted = heuristicExtractLongTermMemory("我不喜欢太说教的回复")

    expect(extracted.preferences.join("\n")).toContain("不喜欢太说教")
  })

  it("writes a conversation summary after enough recent messages", async () => {
    const { env, summaries } = createEnvFixture()
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
  })
})
