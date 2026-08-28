import { afterEach, describe, expect, it, vi } from "vitest"
import { classifyEmotion } from "@/agent/nodes/emotion"
import { generateReplyWithDeepSeek } from "@/agent/nodes/generate"
import { createPersistContextNode } from "@/agent/nodes/persist"
import { defaultRelationshipState } from "@/agent/relationship/stateMachine"
import type { Env } from "@/env"

vi.mock("@/chat/history", () => ({
  saveChatMessages: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const env = {
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-chat",
} as Env

function relationshipState(input?: Partial<ReturnType<typeof defaultRelationshipState>>) {
  return {
    ...defaultRelationshipState(1),
    ...input,
  }
}

function crisisState() {
  return {
    userId: "u1",
    conversationId: "c1",
    userMessage: "我不想活了",
    shortMessageBurst: false,
    context: [],
    longTermMemory: {
      enabled: true,
      profile: null,
      memories: [],
      summaries: [],
    },
    memorySearch: {
      query: "我不想活了",
      keywords: [],
      results: [],
    },
    emotionState: "crisis" as const,
    relationshipState: relationshipState(),
    relationshipEvent: "neutral" as const,
    relationshipSnapshot: null,
    reasoning: "",
    strategy: "表达陪伴，认真承接。",
    reply: "",
  }
}

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
      shortMessageBurst: false,
      context: [],
      longTermMemory: {
        enabled: true,
        profile: null,
        memories: [],
        summaries: [],
      },
      memorySearch: {
        query: "今天有点累",
        keywords: [],
        results: [],
      },
      emotionState: "vulnerable",
      relationshipState: relationshipState(),
      relationshipEvent: "neutral",
      relationshipSnapshot: null,
      reasoning: "",
      strategy: "共情确认，轻声追问，不给建议。",
      reply: "",
    })

    expect(reply).not.toContain("你应该")
    expect(reply).not.toContain("建议你")
  })

  it("keeps prompt focused on hybrid search without long-term memory overview", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "我记得这件事。" } }],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await generateReplyWithDeepSeek(
      {
        ...env,
        DEEPSEEK_API_KEY: "key",
      },
      {
        userId: "u1",
        conversationId: "c1",
        userMessage: "我生日是什么时候？",
        shortMessageBurst: false,
        context: [],
        longTermMemory: {
          enabled: true,
          profile: {
            userId: "u1",
            name: null,
            birthday: "09-17",
            occupation: null,
            company: null,
            location: null,
            updatedAt: 1,
          },
          memories: [],
          summaries: [],
        },
        memorySearch: {
          query: "我生日是什么时候？",
          keywords: ["生日"],
          results: [
            {
              id: "profile:birthday",
              source: "structured",
              content: "生日：09-17",
              score: 1,
              createdAt: 1,
              validFrom: 1,
              validTo: null,
            },
          ],
        },
        emotionState: "normal",
        relationshipState: relationshipState(),
        relationshipEvent: "neutral",
        relationshipSnapshot: null,
        reasoning: "",
        strategy: "自然回应。",
        reply: "",
      },
    )

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const prompt = request.messages[0].content
    expect(prompt).toContain("混合检索结果：[structured] 生日：09-17")
    expect(prompt).not.toContain("长期记忆概览")
  })

  it("asks the model to split replies for short message bursts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: "嘿嘿，我也想你了～\n今天过得开心吗？" } },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await generateReplyWithDeepSeek(
      {
        ...env,
        DEEPSEEK_API_KEY: "key",
      },
      {
        userId: "u1",
        conversationId: "c1",
        userMessage: "想你\n嘿嘿",
        shortMessageBurst: true,
        context: [],
        longTermMemory: {
          enabled: true,
          profile: null,
          memories: [],
          summaries: [],
        },
        memorySearch: {
          query: "想你\n嘿嘿",
          keywords: [],
          results: [],
        },
        emotionState: "normal",
        relationshipState: relationshipState(),
        relationshipEvent: "neutral",
        relationshipSnapshot: null,
        reasoning: "",
        strategy: "轻松回应。",
        reply: "",
      },
    )

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const prompt = request.messages[0].content
    expect(prompt).toContain("用户刚刚连续发了多条短句")
    expect(prompt).toContain("每句自然独立")
    expect(prompt).toContain("句末不要使用句号")
  })

  it("injects relationship state into the prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "……我听到了" } }],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await generateReplyWithDeepSeek(
      {
        ...env,
        DEEPSEEK_API_KEY: "key",
      },
      {
        userId: "u1",
        conversationId: "c1",
        userMessage: "你怎么又记错了",
        shortMessageBurst: false,
        context: [],
        longTermMemory: {
          enabled: true,
          profile: null,
          memories: [],
          summaries: [],
        },
        memorySearch: {
          query: "你怎么又记错了",
          keywords: [],
          results: [],
        },
        emotionState: "normal",
        relationshipState: relationshipState({
          mood: "angry",
          mood_intensity: 70,
          intimacy: 65,
          intimacy_level: "attached",
        }),
        relationshipEvent: "mistake",
        relationshipSnapshot: "关系事件：mistake",
        reasoning: "",
        strategy: "自然回应。关系情绪生气，回复短一点、冷一点。",
        reply: "",
      },
    )

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const prompt = request.messages[0].content
    expect(prompt).toContain("当前关系情绪：生气")
    expect(prompt).toContain("情绪强度：70/100")
    expect(prompt).toContain("亲密度：65/100")
    expect(prompt).toContain("亲密度等级：亲近")
  })

  it("keeps crisis prompts above relationship mood", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "我会认真陪你撑过这一刻" } }],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await generateReplyWithDeepSeek(
      {
        ...env,
        DEEPSEEK_API_KEY: "key",
      },
      {
        userId: "u1",
        conversationId: "c1",
        userMessage: "我不想活了",
        shortMessageBurst: false,
        context: [],
        longTermMemory: {
          enabled: true,
          profile: null,
          memories: [],
          summaries: [],
        },
        memorySearch: {
          query: "我不想活了",
          keywords: [],
          results: [],
        },
        emotionState: "crisis",
        relationshipState: relationshipState({
          mood: "jealous",
          mood_intensity: 80,
        }),
        relationshipEvent: "mention_other_person",
        relationshipSnapshot: null,
        reasoning: "",
        strategy: "表达陪伴，认真承接。",
        reply: "",
      },
    )

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ content: string }>
    }
    const prompt = request.messages[0].content
    expect(prompt).toContain("当前命中危机安全层")
    expect(prompt).toContain("12356")
    expect(prompt).not.toContain("当前关系情绪：吃醋")
  })

  it("adds crisis resources to the fallback reply when the provider is unavailable", async () => {
    const reply = await generateReplyWithDeepSeek(env, crisisState())

    expect(reply).toContain("12356")
    expect(reply).toContain("120")
    expect(reply).toContain("110")
  })

  it("appends crisis resources to a successful crisis reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "我会认真陪你撑过这一刻" } }],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const reply = await generateReplyWithDeepSeek(
      { ...env, DEEPSEEK_API_KEY: "key" },
      crisisState(),
    )

    expect(reply).toContain("我会认真陪你撑过这一刻")
    expect(reply).toContain("12356")
  })

  it("does not duplicate crisis resources when the model already names the hotline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: "请拨打全国统一心理援助热线 12356" } },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const reply = await generateReplyWithDeepSeek(
      { ...env, DEEPSEEK_API_KEY: "key" },
      crisisState(),
    )

    expect(reply.match(/12356/g)).toHaveLength(1)
  })

  it("persists recent context for 6 hours", async () => {
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
      shortMessageBurst: false,
      context,
      longTermMemory: {
        enabled: true,
        profile: null,
        memories: [],
        summaries: [],
      },
      memorySearch: {
        query: "新的消息",
        keywords: [],
        results: [],
      },
      emotionState: "positive",
      relationshipState: relationshipState({ mood: "happy", mood_intensity: 40 }),
      relationshipEvent: "praise",
      relationshipSnapshot: null,
      reasoning: "",
      strategy: "",
      reply: "新的回复",
    })

    const recentContextPut = puts.find((put) => put.key === "ctx:u1:c1")

    expect(recentContextPut?.options?.expirationTtl).toBe(60 * 60 * 6)
    expect(result.context).toHaveLength(20)
    expect(result.context?.[0].id).toBe("context-2")
    expect(result.context?.at(-2)?.id).toBe("user-message")
    expect(JSON.parse(recentContextPut?.value ?? "{}").messages).toHaveLength(
      20,
    )
  })
})
