import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useConversationStore } from "@/stores/conversationStore"
import type { CreateAgentInput, CreateGroupInput } from "./types"

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
  const createGroup = useConversationStore((state) => state.createGroup)
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  )
  const [createMenuVisible, setCreateMenuVisible] = useState(false)
  const [agentModalVisible, setAgentModalVisible] = useState(false)
  const [groupModalVisible, setGroupModalVisible] = useState(false)

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

  const saveGroup = useCallback(
    async (input: CreateGroupInput) => {
      const conversationId = await createGroup(input)
      setActiveConversation(conversationId)
      setGroupModalVisible(false)
      router.push("/chat")
    },
    [createGroup, setActiveConversation],
  )

  const openAgentCreator = useCallback(() => {
    setCreateMenuVisible(false)
    setAgentModalVisible(true)
  }, [])

  const openGroupCreator = useCallback(() => {
    setCreateMenuVisible(false)
    setGroupModalVisible(true)
  }, [])

  const closeAgentModal = useCallback(() => setAgentModalVisible(false), [])
  const closeCreateMenu = useCallback(() => setCreateMenuVisible(false), [])
  const closeGroupModal = useCallback(() => setGroupModalVisible(false), [])
  const openCreateMenu = useCallback(() => setCreateMenuVisible(true), [])

  return {
    agents,
    agentModalVisible,
    closeAgentModal,
    closeCreateMenu,
    closeGroupModal,
    conversations,
    createMenuVisible,
    groupModalVisible,
    loading,
    openAgentCreator,
    openConversation,
    openCreateMenu,
    openGroupCreator,
    saveAgent,
    saveGroup,
    user,
    userAvatarUrl,
    userName,
  }
}
