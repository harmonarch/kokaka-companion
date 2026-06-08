import { useEffect } from "react"
import { router } from "expo-router"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useProfileStore } from "@/stores/profileStore"

export const useChat = () => {
  const user = useAuthStore((state) => state.user)
  const messages = useChatStore((state) => state.messages)
  const status = useChatStore((state) => state.status)
  const connection = useChatStore((state) => state.connection)
  const historyLoaded = useChatStore((state) => state.historyLoaded)
  const historyLoading = useChatStore((state) => state.historyLoading)
  const error = useChatStore((state) => state.error)
  const profiles = useProfileStore((state) => state.profiles)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const connect = useChatStore((state) => state.connect)
  const loadHistory = useChatStore((state) => state.loadHistory)
  const loadOlderHistory = useChatStore((state) => state.loadOlderHistory)
  const disconnect = useChatStore((state) => state.disconnect)
  const send = useChatStore((state) => state.send)

  const inputDisabled = connection !== "connected" || status !== "idle"
  const agentNickname = profiles.agent.nickname?.trim()

  const chatTitle = agentNickname || "今天想说什么"
  const disabledReason =
      connection !== "connected"
        ? "正在重新连接，马上就能继续说。"
        : status !== "idle"
          ? "Kokaka 正在读你的话，等这一句回来后就能继续。"
          : undefined
  
  useEffect(() => {
    if (user) {
      loadProfiles()
      loadHistory()
      connect()
    } 

    return () => disconnect()
  }, [connect, disconnect, loadHistory, loadProfiles, user])


  return {
    user,
    chatTitle,
    messages,
    profiles,
    inputDisabled,
    disabledReason,
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
  }

}