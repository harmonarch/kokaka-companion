import type { Env } from "@/env"
import type { AgentState } from "@/agent/state"
import { formatHybridMemorySearch } from "@/agent/memory/hybridRetrieval"

function fallbackReply(state: AgentState) {
  switch (state.emotionState) {
    case "vulnerable":
      return "听起来你现在真的有点不好受。我在这里陪你。刚刚那一刻，最重的感觉是什么？"
    case "crisis":
      return "这句话听起来很沉重。我会认真陪你把这一刻撑过去，你现在不用一个人扛着这些感受。"
    case "positive":
      return "这真是值得开心的一刻。能感觉到你很在意这件事，我也替你高兴。"
    default:
      return "我听到了。你可以继续说，我会跟着你的节奏回应。"
  }
}

function buildPrompt(state: AgentState) {
  const recent = state.context
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
  const memorySearch = formatHybridMemorySearch(state.memorySearch)
  return [
    "你是一个中文 AI 陪伴 Agent。",
    "回复要短、真诚、像陪伴，不要像心理咨询报告。",
    state.shortMessageBurst
      ? "用户刚刚连续发了多条短句。回复也要拆成短句，每句自然独立，不要合成一个长句。"
      : "",
    "如果状态是 vulnerable，不要使用“你应该”，不要直接给行动建议。",
    "优先使用混合检索结果；检索为空时，不要编造长期记忆。",
    "不要复述无关记忆，不要把记忆清单原样念给用户。",
    `当前策略：${state.strategy}`,
    `混合检索结果：${memorySearch}`,
    `近期上下文：${recent || "无"}`,
    `用户消息：${state.userMessage}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function generateReplyWithDeepSeek(env: Env, state: AgentState) {
  if (!env.DEEPSEEK_API_KEY) {
    return fallbackReply(state)
  }
  try {
    const response = await fetch(
      `${env.DEEPSEEK_BASE_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          messages: [
            {
              role: "system",
              content: buildPrompt(state),
            },
            {
              role: "user",
              content: state.userMessage,
            },
          ],
          temperature: 0.7,
          max_tokens: 240,
        }),
      },
    )
    if (!response.ok) return fallbackReply(state)
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return fallbackReply(state)
    if (
      state.emotionState === "vulnerable" &&
      (content.includes("你应该") || content.includes("建议你"))
    ) {
      return fallbackReply(state)
    }
    return content
  } catch {
    return fallbackReply(state)
  }
}

export function createGenerateNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => ({
    reply: await generateReplyWithDeepSeek(env, state),
  })
}
