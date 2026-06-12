import { useProfileStore } from "@/stores/profileStore"
import { useChatStore } from "@/stores/chatStore"

const moodLabels = {
  calm: "平静",
  happy: "开心",
  angry: "生气",
  sad: "难过",
  shy: "害羞",
  jealous: "吃醋",
} as const

export function useChatHeader() {
  const agentNickname = useProfileStore((state) =>
    state.profiles.agent.nickname?.trim(),
  )
  const agentPresence = useChatStore((state) => state.agentPresence)
  const relationshipState = useChatStore((state) => state.relationshipState)

  const agentStatusText =
    agentPresence === "listening"
      ? "正在倾听..."
      : agentPresence === "replying"
        ? "正在输入..."
        : relationshipState
          ? `${moodLabels[relationshipState.mood]} · 亲密度 ${relationshipState.intimacy}`
          : null

  return {
    chatTitle: agentNickname || "你的 Agent",
    agentStatusText,
  }
}
