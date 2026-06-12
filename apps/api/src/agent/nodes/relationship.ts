import type { AgentState } from "@/agent/state"
import type { Env } from "@/env"
import {
  loadRelationshipState,
  saveRelationshipState,
  updateRelationshipState,
} from "@/agent/relationship/stateMachine"

export function createUpdateRelationshipNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const current = await loadRelationshipState(env, state.userId)
    const update =
      state.emotionState === "crisis"
        ? {
            state: current,
            event: "neutral" as const,
            changed: false,
            snapshot: null,
          }
        : updateRelationshipState(current, state.userMessage)

    await saveRelationshipState(env, state.userId, update.state)

    return {
      relationshipState: update.state,
      relationshipEvent: update.event,
      relationshipSnapshot: update.snapshot,
    }
  }
}
