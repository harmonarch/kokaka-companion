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
  loadPendingOutgoing,
  removeConfirmedOutgoing,
  savePendingOutgoing,
  toPendingUserMessages,
  upsertPendingOutgoing,
  type PendingOutgoingMessage,
} from "./chatReliability"
import { loadJson, saveJson } from "@/utils/storage"
import { useToastStore } from "@/stores/toastStore"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"
import {
  captureAppError,
  createTraceId,
  finishChatRound,
  startChatRound,
} from "@/monitoring/sentry"
import { useConversationStore } from "./conversationStore"
import {
  isSameSession,
  shouldLoadForSession,
  shouldLoadForUser,
  shouldResetSession,
} from "./requestCache"
import { finishServerChatRounds } from "./chatTrace"

type ChatStatus = "idle" | "sending" | "agent_replying" | "error"
type AgentPresence = "listening" | "replying" | null
const typingThrottleMs = 1000

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
  lastTypingSentAt: number
  pendingOutgoing: PendingOutgoingMessage<ChatAgentContext>[]
  pendingOutgoingLoaded: boolean
  loadPendingOutgoing: () => Promise<PendingOutgoingMessage<ChatAgentContext>[]>
  connect: () => void
  loadHistory: (force?: boolean) => Promise<void>
  loadRelationship: () => Promise<void>
  loadOlderHistory: () => Promise<void>
  sendTyping: () => void
  send: (content: string) => Promise<void>
  retrySend: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
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

function showNetworkErrorToast(error: unknown) {
  const message = getNetworkErrorMessage(error)
  if (message) useToastStore.getState().showToast(message)
}

function getActiveConversationId() {
  return useConversationStore.getState().activeConversationId
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
  lastTypingSentAt: 0,
  pendingOutgoing: [],
  pendingOutgoingLoaded: false,
  loadPendingOutgoing: async () => {
    if (get().pendingOutgoingLoaded) return get().pendingOutgoing
    const loaded = await loadPendingOutgoing<ChatAgentContext>({
      loadJson,
      saveJson,
    })
    const hadMissingTraceId = loaded.some((message) => !message.traceId)
    const pending = loaded.map((message) => ({
      ...message,
      traceId: message.traceId ?? createTraceId(),
    }))
    if (hadMissingTraceId) {
      await savePendingOutgoing({ loadJson, saveJson }, pending)
    }
    set({
      pendingOutgoing: pending,
      pendingOutgoingLoaded: true,
      messages: mergeMessages(
        get().messages,
        toPendingUserMessages(pending, getActiveConversationId() ?? ""),
      ),
    })
    return pending
  },
  connect: () => {
    if (get().controller) return
    async function sendPendingMessages() {
      const controller = get().controller
      if (!controller) return false
      const pending = await get().loadPendingOutgoing()
      for (const message of pending) {
        controller.send(
          message.content,
          message.conversationId,
          message.id,
          message.agents,
          message.traceId,
        )
      }
      return pending.length > 0
    }
    const controller = new ChatController({
      wsUrl: chatWsUrl,
      createTicket: async () =>
        (await useAuthStore.getState().client.wsTicket()).ticket,
      createClient: (options) => new ChatWebSocketClient(options),
      onProtocolError: (error) => {
        captureAppError(error, { operation: "chat.protocol" })
      },
      onSendError: (error, traceId) => {
        captureAppError(error, { operation: "chat.send", traceId })
        finishChatRound(traceId, "error")
      },
      onStatus: (connection) => {
        const forceHistoryRefresh = get().connection === "reconnecting"
        set({
          connection,
          agentPresence:
            connection === "connected" ? get().agentPresence : null,
        })
        if (connection === "connected") {
          void sendPendingMessages()
            .then((sentPendingMessages) =>
              get().loadHistory(forceHistoryRefresh || sentPendingMessages),
            )
            .catch((error) => {
              showNetworkErrorToast(error)
              set({
                status: "error",
                error: null,
                agentPresence: null,
              })
            })
        }
      },
      onMessage: (message: ServerWsMessage) => {
        if (message.type === "agent_status") {
          if (message.status === "received" && message.client_message_id) {
            const pendingOutgoing = removeConfirmedOutgoing(
              get().pendingOutgoing,
              message.client_message_id,
            )
            set({
              pendingOutgoing,
              messages: mergeMessages(
                get().messages,
                toPendingUserMessages(
                  pendingOutgoing,
                  getActiveConversationId() ?? "",
                ),
              ),
            })
            void savePendingOutgoing(
              { loadJson, saveJson },
              pendingOutgoing,
            ).catch((error) => {
              showNetworkErrorToast(error)
              set({
                status: "error",
                error: getReadableErrorMessage(error, "消息确认保存失败"),
                agentPresence: null,
              })
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
              id: createTraceId,
              now: Date.now,
            }),
            agentPresence: "replying",
          })
        }
        if (message.type === "nudge") {
          set({
            messages: [
              {
                id: createTransientNudgeId(createTraceId()),
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
                id: createTraceId(),
                role: "agent",
                agent_id: message.agent_id,
                agent_name: message.agent_name,
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
          finishServerChatRounds(message, "ok", finishChatRound)
          set({
            status: "idle",
            emotionState: message.metadata.emotion_state,
            relationshipState: message.metadata.relationship_state,
            agentPresence: null,
          })
        }
        if (message.type === "error") {
          finishServerChatRounds(message, "error", finishChatRound)
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
    const conversationId = getActiveConversationId()
    if (!userId || !conversationId) return
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
        messages: mergeMessages(
          mergeMessages(get().messages, history.messages),
          toPendingUserMessages(get().pendingOutgoing, conversationId),
        ),
        historyLoaded: true,
        historyLoading: false,
        historyHasMore: history.has_more,
        historyUserId: userId,
        historyConversationId: conversationId,
      })
    } catch (error) {
      showNetworkErrorToast(error)
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
        error: getReadableErrorMessage(error, "历史聊天记录载入失败"),
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
      showNetworkErrorToast(error)
      if (useAuthStore.getState().user?.id !== userId) return
      set({
        relationshipUserId: userId,
        relationshipLoaded: true,
        relationshipLoading: false,
        error: getReadableErrorMessage(error, "关系状态载入失败"),
      })
    }
  },
  loadOlderHistory: async () => {
    const userId = useAuthStore.getState().user?.id
    const conversationId = getActiveConversationId()
    const messages = get().messages
    const oldestMessage = messages[messages.length - 1]
    if (
      !userId ||
      !conversationId ||
      !oldestMessage ||
      get().historyLoading ||
      !get().historyLoaded ||
      !get().historyHasMore
    ) {
      return
    }

    set({ historyLoading: true, error: null })
    try {
      const history = await useAuthStore.getState().client.chatHistory({
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
      showNetworkErrorToast(error)
      set({
        historyLoading: false,
        error: getReadableErrorMessage(error, "历史聊天记录载入失败"),
      })
    }
  },
  sendTyping: () => {
    if (get().connection !== "connected") return
    const now = Date.now()
    if (now - get().lastTypingSentAt < typingThrottleMs) return
    const conversationId = getActiveConversationId()
    if (!conversationId) return
    get().controller?.sendTyping(conversationId)
    set({ lastTypingSentAt: now })
  },
  send: async (content) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const conversationStore = useConversationStore.getState()
    const conversationId = conversationStore.activeConversationId
    if (!conversationId) return
    const agents =
      conversationStore.getConversationAgents(conversationId).map((agent) => ({
        id: agent.id,
        name: agent.name,
        persona_prompt: agent.persona_prompt,
      })) ?? []
    const createdAt = Date.now()
    const traceId = createTraceId()
    const userMessage: ChatMessage = {
      id: createTraceId(),
      role: "user",
      content: trimmed,
      created_at: createdAt,
      trace_id: traceId,
    }
    const currentPending = await get().loadPendingOutgoing()
    const pendingOutgoing = upsertPendingOutgoing(currentPending, {
      id: userMessage.id,
      content: trimmed,
      conversationId,
      agents,
      createdAt,
      traceId,
    })
    startChatRound(traceId, conversationId)
    try {
      await savePendingOutgoing({ loadJson, saveJson }, pendingOutgoing)
    } catch (error) {
      captureAppError(error, {
        operation: "chat.pending.save",
        traceId,
        conversationId,
      })
      finishChatRound(traceId, "error")
      showNetworkErrorToast(error)
      set({
        status: "error",
        error: getReadableErrorMessage(error, "消息保存失败"),
        agentPresence: null,
      })
      throw error
    }
    set({
      messages: [userMessage, ...get().messages],
      status: "sending",
      agentPresence: null,
      pendingOutgoing,
      pendingOutgoingLoaded: true,
    })
    conversationStore.updateConversationPreview(conversationId, trimmed)
    try {
      get().controller?.send(
        trimmed,
        conversationId,
        userMessage.id,
        agents,
        traceId,
      )
    } catch (error) {
      showNetworkErrorToast(error)
      set({
        status: "error",
        error: null,
        agentPresence: null,
      })
    }
  },
  retrySend: async (messageId) => {
    const message = (await get().loadPendingOutgoing()).find(
      (item) => item.id === messageId,
    )
    if (!message) return

    let controller = get().controller
    if (!controller) {
      get().connect()
      controller = get().controller
    } else if (get().connection !== "connected") {
      controller.connect()
    }

    try {
      controller?.send(
        message.content,
        message.conversationId,
        message.id,
        message.agents,
        message.traceId,
      )
      set({ status: "sending", error: null, agentPresence: null })
    } catch (error) {
      showNetworkErrorToast(error)
      set({
        status: "error",
        error: null,
        agentPresence: null,
      })
    }
  },
  deleteMessage: async (messageId) => {
    const pendingBeforeDelete = await get().loadPendingOutgoing()
    const messagesBeforeDelete = get().messages
    const pendingOutgoing = removeConfirmedOutgoing(
      pendingBeforeDelete,
      messageId,
    )
    set({
      messages: messagesBeforeDelete.filter(
        (message) => message.id !== messageId,
      ),
      pendingOutgoing,
      pendingOutgoingLoaded: true,
      error: null,
    })
    try {
      await savePendingOutgoing({ loadJson, saveJson }, pendingOutgoing)
      await useAuthStore.getState().client.deleteChatMessage(messageId)
    } catch (error) {
      showNetworkErrorToast(error)
      set({
        messages: messagesBeforeDelete,
        pendingOutgoing: pendingBeforeDelete,
        pendingOutgoingLoaded: true,
        error: getReadableErrorMessage(error, "消息删除失败"),
      })
      await savePendingOutgoing(
        {
          loadJson,
          saveJson,
        },
        pendingBeforeDelete,
      ).catch(showNetworkErrorToast)
      return
    }
    set({ error: null })
    void useConversationStore
      .getState()
      .hydrate(true)
      .catch(showNetworkErrorToast)
  },
  disconnect: () => {
    get().controller?.close()
    set({ controller: null, connection: "idle", agentPresence: null })
  },
}))
