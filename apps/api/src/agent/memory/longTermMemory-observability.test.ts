import { afterEach, describe, expect, it, vi } from "vitest"
import { extractLongTermMemory } from "@/agent/memory/longTermMemory"
import type { LlmCallObservation } from "@/monitoring/llm-call"
import type { Env } from "@/env"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("long-term memory extraction observability", () => {
  it("reports extraction token usage without recording source text", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"facts":[],"events":[],"preferences":["用户喜欢乌龙茶"],"emotionSnapshot":null}',
                },
              },
            ],
            usage: {
              prompt_tokens: 70,
              completion_tokens: 15,
              total_tokens: 85,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const calls: LlmCallObservation[] = []

    await extractLongTermMemory(
      {
        DEEPSEEK_API_KEY: "key",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      } as Env,
      {
        userMessage: "我喜欢乌龙茶",
        reply: "记住了",
        emotionState: "normal",
        onLlmCall: (call) => calls.push(call),
      },
    )

    expect(calls[0]).toEqual(
      expect.objectContaining({
        operation: "memory_extraction",
        status: "success",
        usage: { promptTokens: 70, completionTokens: 15, totalTokens: 85 },
      }),
    )
    expect(info.mock.calls.flat().join("\n")).not.toContain("我喜欢乌龙茶")
  })

  it("reports an empty provider response as a fallback", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [] }), { status: 200 }),
        ),
    )
    const calls: LlmCallObservation[] = []

    await extractLongTermMemory(
      {
        DEEPSEEK_API_KEY: "key",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      } as Env,
      {
        userMessage: "我喜欢乌龙茶",
        reply: "记住了",
        emotionState: "normal",
        onLlmCall: (call) => calls.push(call),
      },
    )

    expect(calls[0]).toEqual(
      expect.objectContaining({
        status: "fallback",
        fallbackReason: "empty_response",
      }),
    )
  })
})
