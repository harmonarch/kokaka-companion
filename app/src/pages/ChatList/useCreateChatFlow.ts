import { router } from "expo-router"
import { useCallback, useState } from "react"
import { useConversationStore } from "@/stores/conversationStore"
import type { CreateAgentInput, CreateGroupInput } from "./types"

export function useCreateChatFlow() {
  const agents = useConversationStore((state) => state.agents)
  const createAgent = useConversationStore((state) => state.createAgent)
  const createGroup = useConversationStore((state) => state.createGroup)
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  )

  const [menuVisible, setMenuVisible] = useState(false)
  const [agentVisible, setAgentVisible] = useState(false)
  const [groupVisible, setGroupVisible] = useState(false)

  const openCreateMenu = useCallback(() => setMenuVisible(true), [])
  const closeCreateMenu = useCallback(() => setMenuVisible(false), [])

  const openAgentCreator = useCallback(() => {
    setMenuVisible(false)
    setAgentVisible(true)
  }, [])

  const closeAgentModal = useCallback(() => setAgentVisible(false), [])

  const openGroupCreator = useCallback(() => {
    setMenuVisible(false)
    setGroupVisible(true)
  }, [])

  const closeGroupModal = useCallback(() => setGroupVisible(false), [])

  const saveAgent = useCallback(
    async (input: CreateAgentInput) => {
      const conversationId = await createAgent(input)
      setActiveConversation(conversationId)
      setAgentVisible(false)
      router.push("/chat")
    },
    [createAgent, setActiveConversation],
  )

  const saveGroup = useCallback(
    async (input: CreateGroupInput) => {
      const conversationId = await createGroup(input)
      setActiveConversation(conversationId)
      setGroupVisible(false)
      router.push("/chat")
    },
    [createGroup, setActiveConversation],
  )

  return {
    agents,
    menuVisible,
    agentVisible,
    groupVisible,
    openCreateMenu,
    closeCreateMenu,
    openAgentCreator,
    closeAgentModal,
    openGroupCreator,
    closeGroupModal,
    saveAgent,
    saveGroup,
  }
}
