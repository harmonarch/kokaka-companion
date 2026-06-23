import { useMemo } from "react"
import { useChatStore } from "@/stores/chatStore"
import { useConversationStore } from "@/stores/conversationStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatMessages() {
  const messages = useChatStore((state) => state.messages)
  const historyLoaded = useChatStore((state) => state.historyLoaded)
  const historyLoading = useChatStore((state) => state.historyLoading)
  const error = useChatStore((state) => state.error)
  const loadOlderHistory = useChatStore((state) => state.loadOlderHistory)
  const sendTyping = useChatStore((state) => state.sendTyping)
  const send = useChatStore((state) => state.send)
  const retrySend = useChatStore((state) => state.retrySend)
  const deleteMessage = useChatStore((state) => state.deleteMessage)
  const connection = useChatStore((state) => state.connection)
  const pendingOutgoing = useChatStore((state) => state.pendingOutgoing)
  const failedMessageIds = new Set(
    connection === "connected"
      ? []
      : pendingOutgoing.map((message) => message.id),
  )
  const profiles = useProfileStore((state) => state.profiles)
  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  )
  const conversations = useConversationStore((state) => state.conversations)
  const agents = useConversationStore((state) => state.agents)
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId),
    [activeConversationId, conversations],
  )
  const conversationAgents = useMemo(
    () =>
      activeConversation
        ? activeConversation.agent_ids
            .flatMap((id) => {
              const agent = agents.find((agent) => agent.id === id)
              return agent ? [agent] : []
            })
        : [],
    [activeConversation, agents],
  )
  const agentAvatarUrl = conversationAgents[0]?.avatar_url?.trim() || null

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
    sendTyping,
    send,
    retrySend,
    deleteMessage,
    failedMessageIds,
  }
}
