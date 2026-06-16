import { useChatStore } from "@/stores/chatStore"
import { useConversationStore } from "@/stores/conversationStore"

const moodLabels = {
  calm: "平静",
  happy: "开心",
  angry: "生气",
  sad: "难过",
  shy: "害羞",
  jealous: "吃醋",
} as const

export function useChatHeader() {
  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  )
  const conversation = useConversationStore((state) =>
    state.conversations.find((item) => item.id === activeConversationId),
  )
  const agentPresence = useChatStore((state) => state.agentPresence)
  const relationshipState = useChatStore((state) => state.relationshipState)

  const agentStatusText =
    agentPresence === "replying"
      ? "正在输入..."
      : relationshipState
        ? `${moodLabels[relationshipState.mood]} · 亲密度 ${relationshipState.intimacy}`
        : null

  return {
    chatTitle: conversation?.title || "聊天",
    agentStatusText,
  }
}
