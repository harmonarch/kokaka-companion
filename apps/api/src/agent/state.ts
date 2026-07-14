import type {
  ChatAgentContext,
  ChatMessage,
  EmotionState,
  RelationshipState,
} from "@ai-companion/shared"
import type { LongTermMemoryContext } from "@/agent/memory/longTermMemory"
import type { MemorySearchContext } from "@/agent/memory/hybridRetrieval"
import type { RelationshipEvent } from "@/agent/relationship/stateMachine"
import type { LlmCallObservation } from "@/monitoring/llm-call"

export type AgentState = {
  userId: string
  conversationId: string
  userMessageId?: string
  agents?: ChatAgentContext[]
  userMessage: string
  shortMessageBurst: boolean
  context: ChatMessage[]
  longTermMemory: LongTermMemoryContext
  memorySearch: MemorySearchContext
  emotionState: EmotionState
  relationshipState: RelationshipState
  relationshipEvent: RelationshipEvent
  relationshipSnapshot: string | null
  reasoning: string
  strategy: string
  reply: string
  llmCalls?: LlmCallObservation[]
}

export type AgentRunResult = {
  emotionState: EmotionState
  relationshipState: RelationshipState
  relationshipSnapshot: string | null
  reply: string
  conversationId: string
  context: ChatMessage[]
  llmCalls: LlmCallObservation[]
}
