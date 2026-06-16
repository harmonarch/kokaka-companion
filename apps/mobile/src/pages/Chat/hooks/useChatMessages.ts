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
  const profiles = useProfileStore((state) => state.profiles)
  const agentAvatarUrl = useConversationStore((state) => {
    const conversationId = state.activeConversationId
    if (!conversationId) return null
    const agent = state.getConversationAgents(conversationId)[0]
    return agent?.avatar_url?.trim() || null
  })

  return {
    messages,
    profiles,
    agentAvatarUrl,
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
  }
}
