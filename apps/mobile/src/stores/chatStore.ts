import type {
  ChatAgentContext,
  ChatMessage,
  EmotionState,
  RelationshipState,
  ServerWsMessage,
} from "@ai-companion/shared"
import { ChatWebSocketClient } from "@ai-companion/api-client"
import { ChatController, type ChatConnectionStatus } from "@ai-companion/core"
import { create } from "zustand"
import { useAuthStore } from "@/stores/authStore"
import { chatWsUrl } from "@/config/api"
import {
  applyTokenMessage,
  createTransientNudgeId,
  isTransientNudge,
} from "./chatMessages"
import {
  removeConfirmedOutgoing,
  shouldRecoverConnection,
  upsertPendingOutgoing,
  type PendingOutgoingMessage,
} from "./chatReliability"
import { useConversationStore } from "./conversationStore"
import {
  isSameSession,
  shouldLoadForSession,
  shouldLoadForUser,
  shouldResetSession,
} from "./requestCache"

type ChatStatus = "idle" | "sending" | "agent_replying" | "error"
type AgentPresence = "listening" | "replying" | null

type ChatState = {
  messages: ChatMessage[]
  status: ChatStatus
  agentPresence: AgentPresence
  connection: ChatConnectionStatus
  historyLoaded: boolean
  historyLoading: boolean
  historyHasMore: boolean
  historyUserId: string | null
  historyConversationId: string | null
  emotionState: EmotionState | null
  relationshipState: RelationshipState | null
  relationshipUserId: string | null
  relationshipLoaded: boolean
  relationshipLoading: boolean
  error: string | null
  controller: ChatController | null
  pendingOutgoing: PendingOutgoingMessage<ChatAgentContext>[]
  connect: () => void
  loadHistory: (force?: boolean) => Promise<void>
  loadRelationship: () => Promise<void>
  loadOlderHistory: () => Promise<void>
  send: (content: string) => void
  disconnect: () => void
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = current.filter((message) => !isTransientNudge(message))

  for (const next of incoming) {
    const duplicate = messages.some(
      (message) =>
        message.id === next.id ||
        (message.role === next.role &&
          message.content === next.content &&
          Math.abs(message.created_at - next.created_at) < 5000),
    )
    if (!duplicate) messages.push(next)
  }

  return messages.sort((a, b) => {
    if (a.created_at !== b.created_at) return b.created_at - a.created_at
    if (a.role !== b.role) return a.role === "agent" ? -1 : 1
    return 0
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: "idle",
  agentPresence: null,
  connection: "idle",
  historyLoaded: false,
  historyLoading: false,
  historyHasMore: true,
  historyUserId: null,
  historyConversationId: null,
  emotionState: null,
  relationshipState: null,
  relationshipUserId: null,
  relationshipLoaded: false,
  relationshipLoading: false,
  error: null,
  controller: null,
  pendingOutgoing: [],
  connect: () => {
    if (get().controller) return
    function sendPendingMessages() {
      const controller = get().controller
      if (!controller) return
      for (const message of get().pendingOutgoing) {
        controller.send(
          message.content,
          message.conversationId,
          message.id,
          message.agents,
        )
      }
    }
    const controller = new ChatController({
      wsUrl: chatWsUrl,
      getTokens: () => useAuthStore.getState().tokens,
      createClient: (options) => new ChatWebSocketClient(options),
      onStatus: (connection) => {
        const previousConnection = get().connection
        set({
          connection,
          agentPresence:
            connection === "connected" ? get().agentPresence : null,
        })
        if (shouldRecoverConnection(previousConnection, connection)) {
          try {
            sendPendingMessages()
            void get().loadHistory(true)
          } catch (error) {
            set({
              status: "error",
              error: error instanceof Error ? error.message : "消息发送失败",
              agentPresence: null,
            })
          }
        }
      },
      onMessage: (message: ServerWsMessage) => {
        if (message.type === "agent_status") {
          if (message.status === "received" && message.client_message_id) {
            set({
              pendingOutgoing: removeConfirmedOutgoing(
                get().pendingOutgoing,
                message.client_message_id,
              ),
            })
          }
          if (message.status === "listening") {
            set({ agentPresence: "listening" })
          }
          if (message.status === "replying") {
            set({ agentPresence: "replying", status: "agent_replying" })
          }
        }
        if (message.type === "topic_start") {
          set({ status: "agent_replying", error: null })
        }
        if (message.type === "token") {
          set({
            messages: applyTokenMessage(get().messages, message, {
              id: crypto.randomUUID,
              now: Date.now,
            }),
            agentPresence: "replying",
          })
        }
        if (message.type === "nudge") {
          set({
            messages: [
              {
                id: createTransientNudgeId(crypto.randomUUID()),
                role: "agent",
                content: message.content,
                created_at: Date.now(),
              },
              ...get().messages,
            ],
          })
        }
        if (message.type === "gentle") {
          set({
            messages: [
              {
                id: crypto.randomUUID(),
                role: "agent",
                content: message.content,
                created_at: Date.now(),
              },
              ...get().messages,
            ],
            status: "agent_replying",
            error: null,
            agentPresence: null,
          })
        }
        if (message.type === "all_done") {
          set({
            status: "idle",
            emotionState: message.metadata.emotion_state,
            relationshipState: message.metadata.relationship_state,
            agentPresence: null,
          })
        }
        if (message.type === "error") {
          set({
            status: "error",
            error: message.message,
            agentPresence: null,
          })
        }
      },
    })
    controller.connect()
    set({ controller })
  },
  loadHistory: async (force = false) => {
    const userId = useAuthStore.getState().user?.id
    const conversationId =
      useConversationStore.getState().activeConversationId ?? "default"
    if (!userId) return
    let historyState = {
      loaded: get().historyLoaded,
      loading: get().historyLoading,
      userId: get().historyUserId,
      sessionId: get().historyConversationId,
    }
    if (shouldResetSession(historyState, userId, conversationId)) {
      set({
        messages: [],
        historyLoaded: false,
        historyLoading: false,
        historyHasMore: true,
        historyUserId: userId,
        historyConversationId: conversationId,
      })
      historyState = {
        loaded: false,
        loading: false,
        userId,
        sessionId: conversationId,
      }
    }
    if (!force && !shouldLoadForSession(historyState, userId, conversationId)) {
      return
    }
    set({ historyLoading: true, error: null })
    try {
      const history = await useAuthStore
        .getState()
        .client.chatHistory({ limit: 20, sessionId: conversationId })
      const currentState = get()
      if (
        useAuthStore.getState().user?.id !== userId ||
        !isSameSession(
          {
            loaded: currentState.historyLoaded,
            loading: currentState.historyLoading,
            userId: currentState.historyUserId,
            sessionId: currentState.historyConversationId,
          },
          userId,
          conversationId,
        )
      ) {
        return
      }
      set({
        messages: mergeMessages(get().messages, history.messages),
        historyLoaded: true,
        historyLoading: false,
        historyHasMore: history.has_more,
        historyUserId: userId,
        historyConversationId: conversationId,
      })
    } catch (error) {
      const currentState = get()
      if (
        useAuthStore.getState().user?.id !== userId ||
        !isSameSession(
          {
            loaded: currentState.historyLoaded,
            loading: currentState.historyLoading,
            userId: currentState.historyUserId,
            sessionId: currentState.historyConversationId,
          },
          userId,
          conversationId,
        )
      ) {
        return
      }
      set({
        historyLoading: false,
        error: error instanceof Error ? error.message : "历史聊天记录载入失败",
      })
    }
  },
  loadRelationship: async () => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    const state = get()
    if (
      !shouldLoadForUser(
        {
          loaded: state.relationshipLoaded,
          loading: state.relationshipLoading,
          userId: state.relationshipUserId,
        },
        userId,
      )
    ) {
      return
    }
    set({ relationshipLoading: true, relationshipUserId: userId, error: null })
    try {
      const response = await useAuthStore.getState().client.relationship()
      if (useAuthStore.getState().user?.id !== userId) return
      set({
        relationshipState: response.relationship_state,
        relationshipUserId: userId,
        relationshipLoaded: true,
        relationshipLoading: false,
      })
    } catch (error) {
      if (useAuthStore.getState().user?.id !== userId) return
      set({
        relationshipUserId: userId,
        relationshipLoaded: true,
        relationshipLoading: false,
        error:
          error instanceof Error ? error.message : "关系状态载入失败",
      })
    }
  },
  loadOlderHistory: async () => {
    const userId = useAuthStore.getState().user?.id
    const conversationId =
      useConversationStore.getState().activeConversationId ?? "default"
    const messages = get().messages
    const oldestMessage = messages[messages.length - 1]
    if (
      !userId ||
      !oldestMessage ||
      get().historyLoading ||
      !get().historyLoaded ||
      !get().historyHasMore
    ) {
      return
    }

    set({ historyLoading: true, error: null })
    try {
      const history = await useAuthStore
        .getState()
        .client.chatHistory({
          beforeId: oldestMessage.id,
          limit: 20,
          sessionId: conversationId,
        })
      set({
        messages: mergeMessages(get().messages, history.messages),
        historyLoading: false,
        historyHasMore: history.has_more,
        historyUserId: userId,
        historyConversationId: conversationId,
      })
    } catch (error) {
      set({
        historyLoading: false,
        error: error instanceof Error ? error.message : "历史聊天记录载入失败",
      })
    }
  },
  send: (content) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const conversationStore = useConversationStore.getState()
    const conversationId = conversationStore.activeConversationId ?? "default"
    const agents =
      conversationStore
        .getConversationAgents(conversationId)
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          persona_prompt: agent.persona_prompt,
        })) ?? []
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      created_at: Date.now(),
    }
    set({
      messages: [userMessage, ...get().messages],
      status: "sending",
      agentPresence: null,
      pendingOutgoing: upsertPendingOutgoing(get().pendingOutgoing, {
        id: userMessage.id,
        content: trimmed,
        conversationId,
        agents,
      }),
    })
    conversationStore.updateConversationPreview(conversationId, trimmed)
    try {
      get().controller?.send(trimmed, conversationId, userMessage.id, agents)
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "消息发送失败",
        agentPresence: null,
      })
    }
  },
  disconnect: () => {
    get().controller?.close()
    set({ controller: null, connection: "idle", agentPresence: null })
  },
}))
