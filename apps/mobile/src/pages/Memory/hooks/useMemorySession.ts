import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useMemoryStore } from "@/stores/memoryStore"

export function useMemorySession() {
  const user = useAuthStore((state) => state.user)
  const loadMemories = useMemoryStore((state) => state.loadMemories)

  useEffect(() => {
    if (user) loadMemories()
  }, [loadMemories, user])

  return {
    user,
  }
}
