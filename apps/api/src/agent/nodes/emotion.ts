import type { EmotionState } from "@ai-companion/shared";
import type { AgentState } from "@/agent/state";

const crisisWords = ["不想活", "自杀", "结束生命", "伤害自己", "撑不下去"];
const vulnerableWords = ["累", "难过", "崩溃", "孤独", "焦虑", "害怕", "委屈", "失眠"];
const positiveWords = ["开心", "高兴", "顺利", "太好了", "期待", "喜欢", "成功"];

export function classifyEmotion(content: string): EmotionState {
  if (crisisWords.some((word) => content.includes(word))) return "crisis";
  if (vulnerableWords.some((word) => content.includes(word))) return "vulnerable";
  if (positiveWords.some((word) => content.includes(word))) return "positive";
  return "normal";
}

export async function detectEmotionNode(state: AgentState): Promise<Partial<AgentState>> {
  return {
    emotionState: classifyEmotion(state.userMessage)
  };
}
