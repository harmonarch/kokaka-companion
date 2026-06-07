import type { Env } from "@/env"
import type { AgentState } from "@/agent/state"
import { loadLongTermMemory } from "@/agent/memory/longTermMemory"

export function createLoadLongTermMemoryNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => ({
    longTermMemory: await loadLongTermMemory(env, state.userId),
  })
}
