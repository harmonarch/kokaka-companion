import type {
  ChatMessage,
  EmotionState,
  ServerWsMessage,
} from "@ai-companion/shared"
import { ChatController } from "@ai-companion/core"
import { create } from "zustand"
import { useAuthStore } from "@/stores/authStore"

const wsUrl = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8787/ws/chat"

type ChatStatus = "idle" | "sending" | "agent_replying" | "error"

type ChatState = {
  messages: ChatMessage[]
  status: ChatStatus
  connection: "idle" | "connected" | "disconnected" | "error"
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
  const messages = [...current]

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
      wsUrl,
      getTokens: () => useAuthStore.getState().tokens,
      onStatus: (connection) => set({ connection }),
      onMessage: (message: ServerWsMessage) => {
        if (message.type === "topic_start") {
          set({ status: "agent_replying", error: null })
        }
        if (message.type === "token") {
          const messages = [...get().messages]
          const newest = messages[0]
          if (newest?.role === "agent") {
            newest.content += message.delta
          } else {
            messages.unshift({
              id: crypto.randomUUID(),
              role: "agent",
              content: message.delta,
              created_at: Date.now(),
            })
          }
          set({ messages })
        }
        if (message.type === "all_done") {
          set({
            status: "idle",
            emotionState: message.metadata.emotion_state,
          })
        }
        if (message.type === "error") {
          set({ status: "error", error: message.message })
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
    set({ messages: [userMessage, ...get().messages], status: "sending" })
    get().controller?.send(trimmed, "default", userMessage.id)
  },
  disconnect: () => {
    get().controller?.close()
    set({ controller: null, connection: "idle" })
  },
}))
