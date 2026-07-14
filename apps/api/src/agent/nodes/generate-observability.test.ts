import { afterEach, describe, expect, it, vi } from "vitest"
import { createGenerateNode } from "@/agent/nodes/generate"
import { defaultRelationshipState } from "@/agent/relationship/stateMachine"
import type { AgentState } from "@/agent/state"
import type { Env } from "@/env"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const state = {
  userId: "u1",
  conversationId: "c1",
  userMessage: "你好",
  shortMessageBurst: false,
  context: [],
  longTermMemory: { enabled: true, profile: null, memories: [], summaries: [] },
  memorySearch: { query: "你好", keywords: [], results: [] },
  emotionState: "normal",
  relationshipState: defaultRelationshipState(),
  relationshipEvent: "neutral",
  relationshipSnapshot: null,
  reasoning: "",
  strategy: "自然回应",
  reply: "",
} satisfies AgentState

const env = {
  LLM_PROVIDER: "deepseek",
  DEEPSEEK_API_KEY: "key",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-chat",
} as Env

describe("generate node observability", () => {
  it("returns token usage and status with the generated reply", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "你好呀" } }],
            usage: {
              prompt_tokens: 80,
              completion_tokens: 12,
              total_tokens: 92,
            },
          }),
          { status: 200 },
        ),
      ),
    )

    const result = await createGenerateNode(env)(state)

    expect(result.reply).toBe("你好呀")
    expect(result.llmCalls).toEqual([
      expect.objectContaining({
        provider: "deepseek",
        model: "deepseek-chat",
        operation: "agent_reply",
        status: "success",
        retries: 0,
        usage: {
          promptTokens: 80,
          completionTokens: 12,
          totalTokens: 92,
        },
      }),
    ])
  })
})
