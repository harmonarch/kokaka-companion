import { router } from "expo-router"
import type { ChatProfiles } from "@ai-companion/shared"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"

export function useSettingsActions({
  nickname,
  createProfiles,
  confirmDelete,
  requestDeleteConfirmation,
  setError,
}: {
  nickname: string
  createProfiles: () => ChatProfiles
  confirmDelete: boolean
  requestDeleteConfirmation: () => void
  setError: (error: string | null) => void
}) {
  const updateNickname = useAuthStore((state) => state.updateNickname)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const updateProfiles = useProfileStore((state) => state.updateProfiles)

  async function save() {
    setError(null)
    try {
      await Promise.all([
        updateNickname(nickname),
        updateProfiles(createProfiles()),
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
      requestDeleteConfirmation()
      return
    }
    await deleteAccount()
    router.replace("/login")
  }

  function goBack() {
    router.back()
  }

  return {
    save,
    signOut,
    remove,
    goBack,
  }
}
