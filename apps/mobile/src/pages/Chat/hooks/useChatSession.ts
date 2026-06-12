import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatSession() {
  const user = useAuthStore((state) => state.user)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const connect = useChatStore((state) => state.connect)
  const loadHistory = useChatStore((state) => state.loadHistory)
  const loadRelationship = useChatStore((state) => state.loadRelationship)
  const disconnect = useChatStore((state) => state.disconnect)

  useEffect(() => {
    if (user) {
      loadProfiles()
      loadHistory()
      loadRelationship()
      connect()
    }

    return () => disconnect()
  }, [connect, disconnect, loadHistory, loadProfiles, loadRelationship, user])

  return {
    user,
  }
}
