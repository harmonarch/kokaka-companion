import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useProfileStore } from "@/stores/profileStore"

export function useChatSession() {
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  const tokens = useAuthStore((state) => state.tokens)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const connect = useChatStore((state) => state.connect)
  const loadHistory = useChatStore((state) => state.loadHistory)
  const loadRelationship = useChatStore((state) => state.loadRelationship)
  const disconnect = useChatStore((state) => state.disconnect)
  const restoringUser = !ready || Boolean(tokens && !user)

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
    restoringUser,
    user,
  }
}
