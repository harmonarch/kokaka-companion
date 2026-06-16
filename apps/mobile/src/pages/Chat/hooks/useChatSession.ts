import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useConversationStore } from "@/stores/conversationStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatSession() {
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  const tokens = useAuthStore((state) => state.tokens)
  const hydrateConversations = useConversationStore((state) => state.hydrate)
  const conversationsReady = useConversationStore((state) => state.ready)
  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  )
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const connect = useChatStore((state) => state.connect)
  const loadHistory = useChatStore((state) => state.loadHistory)
  const loadRelationship = useChatStore((state) => state.loadRelationship)
  const disconnect = useChatStore((state) => state.disconnect)
  const restoringUser = !ready || Boolean(tokens && !user)

  useEffect(() => {
    if (user) void hydrateConversations()
  }, [hydrateConversations, user])

  useEffect(() => {
    if (user && conversationsReady && activeConversationId) {
      loadProfiles()
      loadHistory()
      loadRelationship()
      connect()
    }

    return () => disconnect()
  }, [
    activeConversationId,
    connect,
    conversationsReady,
    disconnect,
    loadHistory,
    loadProfiles,
    loadRelationship,
    user,
  ])

  return {
    restoringUser: restoringUser || (Boolean(user) && !conversationsReady),
    user,
  }
}
