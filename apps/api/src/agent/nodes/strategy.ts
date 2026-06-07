import type { AgentState } from "@/agent/state"

const strategies = {
  normal: "自然回应，保持轻松，不夸张。",
  vulnerable: "先确认感受，轻声追问，不说教，不直接给建议。",
  crisis: "表达陪伴，认真承接，不空洞安慰。",
  positive: "真诚庆祝，回应用户开心。",
} as const

export async function strategyNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  return {
    strategy: strategies[state.emotionState],
  }
}
