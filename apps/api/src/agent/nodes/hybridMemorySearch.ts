import type { Env } from "@/env"
import type { AgentState } from "@/agent/state"
import { searchHybridMemory } from "@/agent/memory/hybridRetrieval"

export function createHybridMemorySearchNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    if (!state.longTermMemory.enabled) {
      return {
        memorySearch: {
          query: state.userMessage,
          keywords: [],
          results: [],
        },
      }
    }
    const llmCalls = [...(state.llmCalls ?? [])]
    return {
      memorySearch: await searchHybridMemory(env, {
        userId: state.userId,
        query: state.userMessage,
        onLlmCall: (call) => llmCalls.push(call),
      }),
      llmCalls,
    }
  }
}
