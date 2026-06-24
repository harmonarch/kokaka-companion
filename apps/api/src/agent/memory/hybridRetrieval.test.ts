import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fuseMemoryResults,
  searchHybridMemory,
} from "@/agent/memory/hybridRetrieval"
import type { Env } from "@/env"

function createEnvFixture() {
  const now = Date.now()
  const profile = {
    userId: "u1",
    name: "小林",
    birthday: "09-17",
    occupation: "运营",
    company: "云杉",
    location: "上海",
    updatedAt: now,
  }
  const memories = [
    {
      id: "m1",
      type: "preference",
      content: "用户喜欢《三体》和刘慈欣的科幻作品",
      createdAt: now,
    },
    {
      id: "m2",
      type: "event",
      content: "用户上周提到准备生日聚餐",
      createdAt: now - 1000 * 60 * 60 * 24 * 3,
    },
  ]
  const summaries = [
    {
      id: "s1",
      summary: "用户上周聊过生日聚餐和工作压力",
      endTime: now - 1000 * 60 * 60 * 24 * 3,
    },
  ]

  const db = {
    prepare(sql: string) {
      return {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values
          return this
        },
        async first<T>() {
          if (sql.includes("FROM user_profiles")) {
            return profile as T
          }
          return null
        },
        async all<T>() {
          if (sql.includes("FROM memories")) {
            const keyword = String(this.values[1]).replaceAll("%", "")
            return {
              results: memories
                .filter((memory) => memory.content.includes(keyword))
                .map((memory) => ({
                  id: memory.id,
                  type: memory.type,
                  content: memory.content,
                  createdAt: memory.createdAt,
                })) as T[],
            }
          }
          if (sql.includes("FROM conversation_summaries")) {
            return { results: summaries as T[] }
          }
          return { results: [] as T[] }
        },
      }
    },
  }

  return {
    env: {
      DB: db,
      MEMORY_VECTORIZE: {
        async query() {
          return {
            matches: [
              {
                id: "v1",
                score: 0.92,
                metadata: {
                  type: "event",
                  content: "用户最近因为工作压力觉得有点累",
                  createdAt: Date.now(),
                },
              },
            ],
          }
        },
      },
      EMBEDDING_BASE_URL: "https://embedding.example.com",
      EMBEDDING_MODEL: "embedding-model",
      EMBEDDING_API_KEY: "embedding-key",
    } as unknown as Env,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("hybrid memory retrieval", () => {
  it("combines structured, keyword and time-range channels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        }),
      ),
    )
    const { env } = createEnvFixture()

    const context = await searchHybridMemory(env, {
      userId: "u1",
      query: "我生日是什么时候？上周是不是提到过《三体》？",
    })

    expect(
      context.results.some((result) => result.source === "structured"),
    ).toBe(true)
    expect(context.results.some((result) => result.source === "keyword")).toBe(
      true,
    )
    expect(
      context.results.some((result) => result.source === "summary_time_range"),
    ).toBe(true)
    expect(context.results.some((result) => result.source === "semantic")).toBe(
      true,
    )
    expect(
      context.results.map((result) => result.content).join("\n"),
    ).toContain("09-17")
  })

  it("deduplicates similar results and keeps the stronger source", () => {
    const [result] = fuseMemoryResults([
      {
        id: "keyword",
        source: "keyword",
        content: "生日：09-17",
        score: 0.9,
        createdAt: Date.now(),
        validFrom: Date.now(),
        validTo: null,
      },
      {
        id: "structured",
        source: "structured",
        content: "生日：09-17",
        score: 0.9,
        createdAt: Date.now(),
        validFrom: Date.now(),
        validTo: null,
      },
    ])

    expect(result.source).toBe("structured")
  })

  it("distinguishes last year and this year location facts", async () => {
    const now = Date.UTC(2026, 5, 24)
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const profile = {
      userId: "u1",
      name: null,
      birthday: null,
      occupation: null,
      company: null,
      location: "上海",
      updatedAt: now,
    }
    const memories = [
      {
        id: "m1",
        type: "event",
        content: "用户去年住在北京",
        createdAt: now - 1000,
        validFrom: now - 1000,
        validTo: null,
      },
      {
        id: "m2",
        type: "event",
        content: "用户今年搬到上海",
        createdAt: now,
        validFrom: now,
        validTo: null,
      },
    ]
    const db = {
      prepare(sql: string) {
        return {
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values
            return this
          },
          async first<T>() {
            if (sql.includes("FROM user_profiles")) return profile as T
            return null
          },
          async all<T>() {
            if (sql.includes("FROM memories")) {
              if (sql.includes("type = 'event'")) {
                return { results: memories as T[] }
              }
              const keyword = String(this.values[1]).replaceAll("%", "")
              return {
                results: memories
                  .filter((memory) => memory.content.includes(keyword))
                  .map((memory) => ({
                    id: memory.id,
                    type: memory.type,
                    content: memory.content,
                    createdAt: memory.createdAt,
                    validFrom: memory.validFrom,
                    validTo: memory.validTo,
                  })) as T[],
              }
            }
            return { results: [] as T[] }
          },
        }
      },
    }
    const env = { DB: db } as unknown as Env

    const context = await searchHybridMemory(env, {
      userId: "u1",
      query: "去年住哪里，今年住哪里",
    })

    expect(context.results.map((result) => result.content)).toEqual(
      expect.arrayContaining(["去年所在地：北京", "今年所在地：上海"]),
    )
  })
})
