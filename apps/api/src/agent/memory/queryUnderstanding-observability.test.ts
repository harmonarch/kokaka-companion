import { afterEach, describe, expect, it, vi } from "vitest"
import { understandMemoryQuery } from "@/agent/memory/queryUnderstanding"
import type { LlmCallObservation } from "@/monitoring/llm-call"
import type { Env } from "@/env"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("memory query understanding observability", () => {
  it("reports token usage for a successful provider call", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"keywords":["生日"],"wantsStructured":true,"wantsTimeRange":false,"wantsSemantic":true}',
                },
              },
            ],
            usage: {
              prompt_tokens: 30,
              completion_tokens: 9,
              total_tokens: 39,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const calls: LlmCallObservation[] = []

    const intent = await understandMemoryQuery(
      {
        DEEPSEEK_API_KEY: "key",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      } as Env,
      "我的生日是什么时候",
      { onLlmCall: (call) => calls.push(call) },
    )

    expect(intent.wantsStructured).toBe(true)
    expect(calls).toEqual([
      expect.objectContaining({
        operation: "query_understanding",
        status: "success",
        retries: 0,
        usage: { promptTokens: 30, completionTokens: 9, totalTokens: 39 },
      }),
    ])
  })

  it("reports why it used heuristics", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    )
    const calls: LlmCallObservation[] = []

    await understandMemoryQuery(
      {
        DEEPSEEK_API_KEY: "key",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      } as Env,
      "最近聊过什么",
      { onLlmCall: (call) => calls.push(call) },
    )

    expect(calls[0]).toEqual(
      expect.objectContaining({
        operation: "query_understanding",
        status: "fallback",
        fallbackReason: "http_503",
      }),
    )
  })
})
