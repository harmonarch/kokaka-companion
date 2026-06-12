import type { AgentState } from "@/agent/state"

export async function reasoningNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const contextHint =
    state.context.length > 0
      ? `已有 ${state.context.length} 条近期上下文。`
      : "没有可用的近期上下文。"
  return {
    reasoning: `${contextHint} 当前用户状态为 ${state.emotionState}，关系情绪为 ${state.relationshipState.mood}，亲密度为 ${state.relationshipState.intimacy}。`,
  }
}
