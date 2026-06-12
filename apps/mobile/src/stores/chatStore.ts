import type {
  ChatMessage,
  EmotionState,
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
  emotionState: EmotionState | null
  error: string | null
  controller: ChatController | null
  connect: () => void
  loadHistory: () => Promise<void>
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
  emotionState: null,
  error: null,
  controller: null,
  connect: () => {
    const controller = new ChatController({
      wsUrl: chatWsUrl,
      getTokens: () => useAuthStore.getState().tokens,
      createClient: (options) => new ChatWebSocketClient(options),
      onStatus: (connection) =>
        set({
          connection,
          agentPresence:
            connection === "connected" ? get().agentPresence : null,
        }),
      onMessage: (message: ServerWsMessage) => {
        if (message.type === "agent_status") {
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
  loadHistory: async () => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    if (get().historyUserId && get().historyUserId !== userId) {
      set({
        messages: [],
        historyLoaded: false,
        historyHasMore: true,
        historyUserId: userId,
      })
    }
    if (get().historyLoading || get().historyLoaded) return
    set({ historyLoading: true, error: null })
    try {
      const history = await useAuthStore
        .getState()
        .client.chatHistory({ limit: 20 })
      set({
        messages: mergeMessages(get().messages, history.messages),
        historyLoaded: true,
        historyLoading: false,
        historyHasMore: history.has_more,
        historyUserId: userId,
      })
    } catch (error) {
      set({
        historyLoading: false,
        error: error instanceof Error ? error.message : "历史聊天记录载入失败",
      })
    }
  },
  loadOlderHistory: async () => {
    const userId = useAuthStore.getState().user?.id
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
        .client.chatHistory({ beforeId: oldestMessage.id, limit: 20 })
      set({
        messages: mergeMessages(get().messages, history.messages),
        historyLoading: false,
        historyHasMore: history.has_more,
        historyUserId: userId,
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
    })
    try {
      get().controller?.send(trimmed, "default", userMessage.id)
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
