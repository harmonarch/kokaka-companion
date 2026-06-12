import type { AgentState } from "@/agent/state"

const strategies = {
  normal: "自然回应，保持轻松，不夸张。",
  vulnerable: "先确认感受，轻声追问，不说教，不直接给建议。",
  crisis: "表达陪伴，认真承接，不空洞安慰。",
  positive: "真诚庆祝，回应用户开心。",
} as const

const relationshipStrategies = {
  calm: "关系情绪平静，保持自然、温柔、日常。",
  happy: "关系情绪开心，语气可以更轻快、更主动，但不要夸张。",
  angry: "关系情绪生气，回复短一点、冷一点，但不能攻击用户。",
  sad: "关系情绪难过，语气低落敏感，让用户感到她需要被在意。",
  shy: "关系情绪害羞，表达含蓄亲近，可以轻微害羞。",
  jealous: "关系情绪吃醋，可以酸一点、旁敲侧击，但不要失控。",
} as const

export async function strategyNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const relationshipStrategy =
    state.emotionState === "crisis"
      ? "当前命中危机安全层，忽略关系情绪风格。"
      : relationshipStrategies[state.relationshipState.mood]
  return {
    strategy: `${strategies[state.emotionState]} ${relationshipStrategy}`,
  }
}
