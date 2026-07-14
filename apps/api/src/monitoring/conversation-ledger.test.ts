import { describe, expect, it } from "vitest"
import {
  recordConversationObservationEvent,
  isTokenUsageAnomalous,
  startConversationObservation,
  updateConversationObservation,
} from "./conversation-ledger"
import type { Env } from "@/env"

function createDatabase() {
  const statements: Array<{ sql: string; values: unknown[] }> = []
  const DB = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        run: async () => {
          statements.push({ sql, values })
          return { success: true }
        },
      }),
    }),
  }
  return { env: { DB } as unknown as Env, statements }
}

describe("conversation observation ledger", () => {
  it("flags token usage above the hard limit", async () => {
    await expect(
      isTokenUsageAnomalous({ TOKEN_ALERT_HARD_LIMIT: "500", DB: {} } as Env, {
        userId: "user-1",
        totalTokens: 500,
      }),
    ).resolves.toBe(true)
  })

  it("flags token usage far above the recent baseline", async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ average_tokens: 200 }),
          }),
        }),
      },
    } as unknown as Env

    await expect(
      isTokenUsageAnomalous(env, { userId: "user-1", totalTokens: 600 }),
    ).resolves.toBe(true)
  })

  it("starts one observation without storing message content", async () => {
    const { env, statements } = createDatabase()

    await startConversationObservation(env, {
      traceId: "trace-1",
      userId: "user-1",
      conversationId: "conversation-1",
      expressionGroupId: "expression-1",
      startedAt: 100,
    })

    expect(statements).toHaveLength(1)
    expect(statements[0].sql).toContain("INSERT INTO conversation_observations")
    expect(statements[0].values).toEqual([
      "trace-1",
      "trace-1",
      "user-1",
      "conversation-1",
      "expression-1",
      "started",
      100,
      100,
    ])
    expect(statements[0].sql).not.toMatch(/content|prompt|response/i)
  })

  it("updates outcome, timings, token totals, and storage results", async () => {
    const { env, statements } = createDatabase()

    await updateConversationObservation(env, {
      traceId: "trace-1",
      status: "degraded",
      degradationReason: "vectorize_unavailable",
      firstResponseMs: 300,
      totalDurationMs: 800,
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
      modelCallCount: 3,
      chatStored: true,
      contextStored: false,
      memoryStored: true,
      vectorStored: false,
      updatedAt: 900,
    })

    expect(statements).toHaveLength(1)
    expect(statements[0].sql).toContain("UPDATE conversation_observations")
    expect(statements[0].values).toEqual([
      "degraded",
      "degraded",
      "degraded",
      "degraded",
      "vectorize_unavailable",
      300,
      800,
      120,
      40,
      160,
      3,
      1,
      0,
      1,
      0,
      900,
      "trace-1",
    ])
  })

  it("records a structured stage event without message payloads", async () => {
    const { env, statements } = createDatabase()

    await recordConversationObservationEvent(env, {
      id: "event-1",
      traceId: "trace-1",
      stage: "agent.generate",
      status: "failed",
      durationMs: 250,
      provider: "deepseek",
      model: "deepseek-chat",
      promptTokens: 100,
      completionTokens: 0,
      totalTokens: 100,
      errorCode: "provider_timeout",
      externalTraceId: "langsmith-1",
      occurredAt: 500,
    })

    expect(statements[0].sql).toContain(
      "INSERT INTO conversation_observation_events",
    )
    expect(statements[0].values).toEqual([
      "event-1",
      "trace-1",
      "agent.generate",
      "failed",
      250,
      "deepseek",
      "deepseek-chat",
      100,
      0,
      100,
      "provider_timeout",
      "langsmith-1",
      500,
    ])
    expect(statements[0].sql).not.toMatch(/content|prompt_text|response_text/i)
  })
})
