import { describe, expect, it, vi } from "vitest"
import { observeLlmCall } from "@/monitoring/llm-call"

describe("LLM call observability", () => {
  it("records operational metadata and token usage without model content", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)

    const observation = observeLlmCall({
      provider: "deepseek",
      model: "deepseek-chat",
      operation: "agent_reply",
      durationMs: 42,
      status: "success",
      retries: 0,
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150,
      },
    })

    expect(observation).toEqual({
      provider: "deepseek",
      model: "deepseek-chat",
      operation: "agent_reply",
      durationMs: 42,
      status: "success",
      retries: 0,
      usage: {
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
      },
    })
    expect(JSON.stringify(info.mock.calls)).not.toContain("content")
  })
})
