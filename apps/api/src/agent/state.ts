import type { ChatMessage, EmotionState } from "@ai-companion/shared";

export type AgentState = {
  userId: string;
  userMessage: string;
  context: ChatMessage[];
  emotionState: EmotionState;
  reasoning: string;
  strategy: string;
  reply: string;
};

export type AgentRunResult = {
  emotionState: EmotionState;
  reply: string;
};
