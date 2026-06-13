import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useMemoryStore } from "@/stores/memoryStore"

export function useMemorySession() {
  const user = useAuthStore((state) => state.user)
  const ready = useAuthStore((state) => state.ready)
  const tokens = useAuthStore((state) => state.tokens)
  const loadMemories = useMemoryStore((state) => state.loadMemories)
  const restoringUser = !ready || Boolean(tokens && !user)

  useEffect(() => {
    if (ready && user) loadMemories()
  }, [loadMemories, ready, user])

  return {
    restoringUser,
    user,
  }
}
