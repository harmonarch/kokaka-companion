import { afterEach, describe, expect, it, vi } from "vitest"
import {
  queryMemoryVectors,
  upsertMemoryVector,
} from "@/agent/memory/vectorMemory"
import type { LlmCallObservation } from "@/monitoring/llm-call"
import type { Env } from "@/env"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("embedding observability", () => {
  it("reports embedding usage and does not expose its input", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, 0.2] }],
            usage: { prompt_tokens: 6, total_tokens: 6 },
          }),
          { status: 200 },
        ),
      ),
    )
    const calls: LlmCallObservation[] = []

    await queryMemoryVectors(
      {
        EMBEDDING_API_KEY: "key",
        EMBEDDING_BASE_URL: "https://embedding.example.com",
        EMBEDDING_MODEL: "embedding-model",
        MEMORY_VECTORIZE: { query: vi.fn().mockResolvedValue({ matches: [] }) },
      } as unknown as Env,
      {
        userId: "u1",
        query: "私密的查询内容",
        onLlmCall: (call) => calls.push(call),
      },
    )

    expect(calls[0]).toEqual(
      expect.objectContaining({
        operation: "memory_embedding_query",
        status: "success",
        usage: { promptTokens: 6, completionTokens: 0, totalTokens: 6 },
      }),
    )
    expect(info.mock.calls.flat().join("\n")).not.toContain("私密的查询内容")
  })

  it("reports a provider error before returning no matches", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    )
    const calls: LlmCallObservation[] = []

    const matches = await queryMemoryVectors(
      {
        EMBEDDING_API_KEY: "key",
        EMBEDDING_BASE_URL: "https://embedding.example.com",
        EMBEDDING_MODEL: "embedding-model",
        MEMORY_VECTORIZE: { query: vi.fn() },
      } as unknown as Env,
      {
        userId: "u1",
        query: "查询",
        onLlmCall: (call) => calls.push(call),
      },
    )

    expect(matches).toEqual([])
    expect(calls[0]).toEqual(
      expect.objectContaining({
        status: "fallback",
        fallbackReason: "http_429",
      }),
    )
  })

  it("returns a reason when Vectorize rejects an upsert", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: [0.1] }] }), {
          status: 200,
        }),
      ),
    )
    const results: Array<{ success: boolean; reason?: string }> = []

    await expect(
      upsertMemoryVector(
        {
          EMBEDDING_API_KEY: "key",
          EMBEDDING_BASE_URL: "https://embedding.example.com",
          EMBEDDING_MODEL: "embedding-model",
          MEMORY_VECTORIZE: {
            upsert: vi.fn().mockRejectedValue(new Error("unavailable")),
          },
        } as unknown as Env,
        {
          id: "m1",
          userId: "u1",
          conversationId: "c1",
          type: "preference",
          content: "用户喜欢乌龙茶",
          createdAt: 1,
          onVectorResult: (result) => results.push(result),
        },
      ),
    ).resolves.toBe(false)
    expect(results).toEqual([
      { success: false, reason: "vector_upsert_failed" },
    ])
  })
})
