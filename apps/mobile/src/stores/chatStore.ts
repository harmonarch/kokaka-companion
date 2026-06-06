import type { ChatMessage, EmotionState, ServerWsMessage } from "@ai-companion/shared";
import { ChatController } from "@ai-companion/core";
import { create } from "zustand";
import { useAuthStore } from "@/stores/authStore";

const wsUrl = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8787/ws/chat";

type ChatStatus = "idle" | "sending" | "agent_replying" | "error";

type ChatState = {
  messages: ChatMessage[];
  status: ChatStatus;
  connection: "idle" | "connected" | "disconnected" | "error";
  emotionState: EmotionState | null;
  error: string | null;
  controller: ChatController | null;
  connect: () => void;
  send: (content: string) => void;
  disconnect: () => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: "idle",
  connection: "idle",
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
          set({ status: "agent_replying", error: null });
        }
        if (message.type === "token") {
          const messages = [...get().messages];
          const last = messages[messages.length - 1];
          if (last?.role === "agent") {
            last.content += message.delta;
          } else {
            messages.push({
              id: crypto.randomUUID(),
              role: "agent",
              content: message.delta,
              created_at: Date.now()
            });
          }
          set({ messages });
        }
        if (message.type === "all_done") {
          set({
            status: "idle",
            emotionState: message.metadata.emotion_state
          });
        }
        if (message.type === "error") {
          set({ status: "error", error: message.message });
        }
      }
    });
    controller.connect();
    set({ controller });
  },
  send: (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      created_at: Date.now()
    };
    set({ messages: [...get().messages, userMessage], status: "sending" });
    get().controller?.send(trimmed, "default", userMessage.id);
  },
  disconnect: () => {
    get().controller?.close();
    set({ controller: null, connection: "idle" });
  }
}));
