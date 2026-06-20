import { router } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { useProfileEditorModal } from "@/pages/Chat/hooks/useProfileEditorModal"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import type { AccountAction } from "./components/AccountActionConfirmDialog"

type BusyAction = AccountAction | null

export function useProfilePage() {
  const ready = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const profiles = useProfileStore((state) => state.profiles)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const profileEditor = useProfileEditorModal()
  const { openProfileEditor } = profileEditor
  const [confirmAction, setConfirmAction] = useState<AccountAction | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)

  useEffect(() => {
    if (user) void loadProfiles()
  }, [loadProfiles, user])

  const closeConfirmDialog = useCallback(() => {
    if (busy === null) setConfirmAction(null)
  }, [busy])

  const runAccountAction = useCallback(
    async (action: AccountAction) => {
      if (busy !== null) return

      setBusy(action)
      try {
        if (action === "logout") {
          await logout()
        } else {
          await deleteAccount()
        }

        setBusy(null)
        setConfirmAction(null)
        router.replace("/login")
      } catch (error) {
        setBusy(null)
        throw error
      }
    },
    [busy, deleteAccount, logout],
  )

  const confirmSelectedAction = useCallback(() => {
    if (confirmAction) void runAccountAction(confirmAction)
  }, [confirmAction, runAccountAction])

  const openUserProfileEditor = useCallback(() => {
    openProfileEditor("user")
  }, [openProfileEditor])

  const userProfile = profiles.user

  return {
    avatar: userProfile.avatar_url?.trim() ?? "",
    busy,
    closeConfirmDialog,
    confirmAction,
    confirmSelectedAction,
    loading: !ready,
    nickname: userProfile.nickname?.trim() || user?.nickname || "我",
    openUserProfileEditor,
    profileEditor,
    requestAccountAction: setConfirmAction,
    user,
  }
}
