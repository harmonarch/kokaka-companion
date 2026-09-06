import { router } from "expo-router"
import { useCallback, useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useConversationStore } from "@/stores/conversationStore"

export function useChatListPage() {
  const authReady = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const hydrate = useConversationStore((state) => state.hydrate)
  const conversationsReady = useConversationStore((state) => state.ready)
  const conversations = useConversationStore((state) => state.conversations)
  const agents = useConversationStore((state) => state.agents)
  const userAvatarUrl = useConversationStore((state) => state.userAvatarUrl)
  const storedUserName = useConversationStore((state) => state.userName)
  const pinConversation = useConversationStore((state) => state.pinConversation)
  const unpinConversation = useConversationStore(
    (state) => state.unpinConversation,
  )
  const deleteConversation = useConversationStore(
    (state) => state.deleteConversation,
  )
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  )

  useEffect(() => {
    if (user) void hydrate()
  }, [hydrate, user])

  const loading = !authReady || Boolean(user && !conversationsReady)
  const userName = storedUserName || user?.nickname || "我"

  const openConversation = useCallback(
    (conversationId: string) => {
      setActiveConversation(conversationId)
      router.push("/chat")
    },
    [setActiveConversation],
  )

  return {
    agents,
    conversations,
    loading,
    openConversation,
    pinConversation,
    unpinConversation,
    deleteConversation,
    user,
    userAvatarUrl,
    userName,
  }
}
