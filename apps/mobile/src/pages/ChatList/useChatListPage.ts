import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useConversationStore } from "@/stores/conversationStore"
import type { CreateAgentInput } from "./types"

export function useChatListPage() {
  const authReady = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const hydrate = useConversationStore((state) => state.hydrate)
  const conversationsReady = useConversationStore((state) => state.ready)
  const conversations = useConversationStore((state) => state.conversations)
  const agents = useConversationStore((state) => state.agents)
  const userAvatarUrl = useConversationStore((state) => state.userAvatarUrl)
  const storedUserName = useConversationStore((state) => state.userName)
  const createAgent = useConversationStore((state) => state.createAgent)
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  )
  const [agentModalVisible, setAgentModalVisible] = useState(false)

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

  const saveAgent = useCallback(
    async (input: CreateAgentInput) => {
      const conversationId = await createAgent(input)
      setActiveConversation(conversationId)
      setAgentModalVisible(false)
      router.push("/chat")
    },
    [createAgent, setActiveConversation],
  )

  const openAgentCreator = useCallback(() => {
    setAgentModalVisible(true)
  }, [])

  const closeAgentModal = useCallback(() => setAgentModalVisible(false), [])

  return {
    agents,
    agentModalVisible,
    closeAgentModal,
    conversations,
    loading,
    openAgentCreator,
    openConversation,
    saveAgent,
    user,
    userAvatarUrl,
    userName,
  }
}
