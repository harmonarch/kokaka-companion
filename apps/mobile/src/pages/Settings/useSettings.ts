import type { ChatProfile } from "@ai-companion/shared"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"

export function useSettings() {
  const user = useAuthStore((state) => state.user)
  const updateNickname = useAuthStore((state) => state.updateNickname)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const updateProfiles = useProfileStore((state) => state.updateProfiles)
  const [nickname, setNickname] = useState(user?.nickname ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadProfiles()
  }, [loadProfiles, user])

  useEffect(() => {
    setNickname(user?.nickname ?? "")
  }, [user?.nickname])

  async function save({
    userProfile,
    agentProfile,
  }: {
    userProfile: ChatProfile
    agentProfile: ChatProfile
  }) {
    setError(null)
    try {
      await Promise.all([
        updateNickname(nickname),
        updateProfiles({
          user: userProfile,
          agent: agentProfile,
        }),
      ])
      router.replace("/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    }
  }

  async function signOut() {
    await logout()
    router.replace("/login")
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteAccount()
    router.replace("/login")
  }

  function cancelDelete() {
    setConfirmDelete(false)
  }

  return {
    user,
    nickname,
    setNickname,
    confirmDelete,
    error,
    setError,
    save,
    signOut,
    remove,
    cancelDelete,
  }
}
