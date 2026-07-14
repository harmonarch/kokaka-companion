import { afterEach, describe, expect, it, vi } from "vitest"
import { LLMEvaluator } from "@/ws/collector/llm-evaluator"
import type { Env } from "@/env"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("LLMEvaluator observability", () => {
  it("records an explicit fallback when the provider is not configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const evaluator = new LLMEvaluator({
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
    } as Env)

    await expect(evaluator.evaluate(["你好"])).resolves.toEqual({
      status: "complete",
      emotionIntensity: 0.5,
    })
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('"fallbackReason":"provider_not_configured"'),
    )
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('"operation":"expression_evaluation"'),
    )
  })

  it("records retry exhaustion and the HTTP fallback reason", async () => {
    vi.useFakeTimers()
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)
    const evaluator = new LLMEvaluator({
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
    } as Env)

    const result = evaluator.evaluate(["你好"])
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      status: "complete",
      emotionIntensity: 0.5,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"retries":3'))
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('"fallbackReason":"http_503"'),
    )
  })

  it("records token usage for successful expression evaluation", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    status: "complete",
                    emotionIntensity: 0.2,
                  }),
                },
              },
            ],
            usage: {
              prompt_tokens: 40,
              completion_tokens: 8,
              total_tokens: 48,
            },
          }),
          { status: 200 },
        ),
      ),
    )
    const evaluator = new LLMEvaluator({
      LLM_PROVIDER: "deepseek",
      DEEPSEEK_API_KEY: "key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
    } as Env)

    await evaluator.evaluate(["你好"])

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining(
        '"usage":{"promptTokens":40,"completionTokens":8,"totalTokens":48}',
      ),
    )
  })
})
