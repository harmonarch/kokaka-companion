import { useChatStore } from "@/stores/chatStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatMessages() {
  const messages = useChatStore((state) => state.messages)
  const historyLoaded = useChatStore((state) => state.historyLoaded)
  const historyLoading = useChatStore((state) => state.historyLoading)
  const error = useChatStore((state) => state.error)
  const loadOlderHistory = useChatStore((state) => state.loadOlderHistory)
  const send = useChatStore((state) => state.send)
  const profiles = useProfileStore((state) => state.profiles)

  return {
    messages,
    profiles,
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
  }
}
