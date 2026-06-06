import type { ChatMessage, EmotionState } from "@ai-companion/shared";
import type { LongTermMemoryContext } from "@/agent/memory/longTermMemory";

export type AgentState = {
  userId: string;
  conversationId: string;
  userMessageId?: string;
  userMessage: string;
  context: ChatMessage[];
  longTermMemory: LongTermMemoryContext;
  emotionState: EmotionState;
  reasoning: string;
  strategy: string;
  reply: string;
};

export type AgentRunResult = {
  emotionState: EmotionState;
  reply: string;
  conversationId: string;
  context: ChatMessage[];
};
