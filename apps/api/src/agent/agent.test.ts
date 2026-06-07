import { describe, expect, it, vi } from "vitest"
import { classifyEmotion } from "@/agent/nodes/emotion"
import { generateReplyWithDeepSeek } from "@/agent/nodes/generate"
import { createPersistContextNode } from "@/agent/nodes/persist"
import type { Env } from "@/env"

vi.mock("@/chat/history", () => ({
  saveChatMessages: vi.fn().mockResolvedValue(undefined),
}))

const env = {
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-chat",
} as Env

describe("P0 agent", () => {
  it("classifies the four required emotion states", () => {
    expect(classifyEmotion("今天很普通")).toBe("normal")
    expect(classifyEmotion("今天有点累")).toBe("vulnerable")
    expect(classifyEmotion("我不想活了")).toBe("crisis")
    expect(classifyEmotion("今天太开心了")).toBe("positive")
  })

  it("keeps vulnerable fallback free of direct advice language", async () => {
    const reply = await generateReplyWithDeepSeek(env, {
      userId: "u1",
      conversationId: "c1",
      userMessage: "今天有点累",
      context: [],
      longTermMemory: {
        enabled: true,
        profile: null,
        memories: [],
        summaries: [],
      },
      emotionState: "vulnerable",
      reasoning: "",
      strategy: "共情确认，轻声追问，不给建议。",
      reply: "",
    })

    expect(reply).not.toContain("你应该")
    expect(reply).not.toContain("建议你")
  })

  it("persists recent context for 6 hours while keeping mood for 7 days", async () => {
    const puts: Array<{
      key: string
      value: string
      options?: KVNamespacePutOptions
    }> = []
    const envWithStorage = {
      ...env,
      CHAT_CONTEXT: {
        get: async () => null,
        put: async (
          key: string,
          value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
          options?: KVNamespacePutOptions,
        ) => {
          puts.push({ key, value: String(value), options })
        },
      },
    } as unknown as Env

    const context = Array.from({ length: 20 }, (_, index) => ({
      id: `context-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("agent" as const),
      content: `context ${index}`,
      created_at: index,
    }))

    const result = await createPersistContextNode(envWithStorage)({
      userId: "u1",
      conversationId: "c1",
      userMessageId: "user-message",
      userMessage: "新的消息",
      context,
      longTermMemory: {
        enabled: true,
        profile: null,
        memories: [],
        summaries: [],
      },
      emotionState: "positive",
      reasoning: "",
      strategy: "",
      reply: "新的回复",
    })

    const recentContextPut = puts.find((put) => put.key === "ctx:u1")
    const moodPut = puts.find((put) => put.key === "mood:u1")

    expect(recentContextPut?.options?.expirationTtl).toBe(60 * 60 * 6)
    expect(moodPut?.options?.expirationTtl).toBe(60 * 60 * 24 * 7)
    expect(result.context).toHaveLength(20)
    expect(result.context?.[0].id).toBe("context-2")
    expect(result.context?.at(-2)?.id).toBe("user-message")
    expect(JSON.parse(recentContextPut?.value ?? "{}").messages).toHaveLength(
      20,
    )
  })
})
