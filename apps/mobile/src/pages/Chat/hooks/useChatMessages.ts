import { useChatStore } from "@/stores/chatStore"
import { useConversationStore } from "@/stores/conversationStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatMessages() {
  const messages = useChatStore((state) => state.messages)
  const historyLoaded = useChatStore((state) => state.historyLoaded)
  const historyLoading = useChatStore((state) => state.historyLoading)
  const error = useChatStore((state) => state.error)
  const loadOlderHistory = useChatStore((state) => state.loadOlderHistory)
  const send = useChatStore((state) => state.send)
  const retrySend = useChatStore((state) => state.retrySend)
  const connection = useChatStore((state) => state.connection)
  const pendingOutgoing = useChatStore((state) => state.pendingOutgoing)
  const failedMessageIds = new Set(
    connection === "connected"
      ? []
      : pendingOutgoing.map((message) => message.id),
  )
  const profiles = useProfileStore((state) => state.profiles)
  const agentAvatarUrl = useConversationStore((state) => {
    const conversationId = state.activeConversationId
    if (!conversationId) return null
    const agent = state.getConversationAgents(conversationId)[0]
    return agent?.avatar_url?.trim() || null
  })
  const conversationAgents = useConversationStore((state) => {
    const conversationId = state.activeConversationId
    return conversationId ? state.getConversationAgents(conversationId) : []
  })
  const activeConversation = useConversationStore((state) =>
    state.conversations.find((item) => item.id === state.activeConversationId),
  )

  return {
    messages,
    profiles,
    agentAvatarUrl,
    conversationAgents,
    showAgentNames: activeConversation?.type === "group",
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
    retrySend,
    failedMessageIds,
  }
}
