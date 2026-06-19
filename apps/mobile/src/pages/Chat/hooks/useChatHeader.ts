import { useMemo } from "react"
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
  const conversations = useConversationStore((state) => state.conversations)
  const agents = useConversationStore((state) => state.agents)
  const conversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId),
    [activeConversationId, conversations],
  )
  const conversationAgents = useMemo(
    () =>
      conversation
        ? conversation.agent_ids
            .flatMap((id) => {
              const agent = agents.find((agent) => agent.id === id)
              return agent ? [agent] : []
            })
        : [],
    [agents, conversation],
  )
  const agentPresence = useChatStore((state) => state.agentPresence)
  const relationshipState = useChatStore((state) => state.relationshipState)
  const memberText =
    conversation?.type === "group"
      ? conversationAgents.map((agent) => agent.name).join("、")
      : null

  const agentStatusText =
    agentPresence === "replying"
      ? "正在输入..."
      : memberText
        ? memberText
      : relationshipState
        ? `${moodLabels[relationshipState.mood]} · 亲密度 ${relationshipState.intimacy}`
        : null

  return {
    chatTitle: conversation?.title || "聊天",
    agentStatusText,
  }
}
