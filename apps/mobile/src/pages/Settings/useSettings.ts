import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { useDeleteAccountConfirm } from "./useDeleteAccountConfirm"
import { useSettingsAccountForm } from "./useSettingsAccountForm"
import { useSettingsActions } from "./useSettingsActions"
import { useSettingsError } from "./useSettingsError"
import { useSettingsProfilesForm } from "./useSettingsProfilesForm"

export function useSettings() {
  const user = useAuthStore((state) => state.user)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const account = useSettingsAccountForm(user)
  const deleteConfirm = useDeleteAccountConfirm()
  const settingsError = useSettingsError()
  const profiles = useSettingsProfilesForm({
    onError: settingsError.setError,
  })
  const actions = useSettingsActions({
    nickname: account.nickname,
    createProfiles: profiles.createProfiles,
    confirmDelete: deleteConfirm.confirmDelete,
    requestDeleteConfirmation: deleteConfirm.requestDeleteConfirmation,
    setError: settingsError.setError,
  })

  useEffect(() => {
    if (user) loadProfiles()
  }, [loadProfiles, user])

  return {
    user,
    nickname: account.nickname,
    setNickname: account.setNickname,
    userProfile: profiles.userProfile,
    agentProfile: profiles.agentProfile,
    confirmDelete: deleteConfirm.confirmDelete,
    error: settingsError.error,
    save: actions.save,
    signOut: actions.signOut,
    remove: actions.remove,
    cancelDelete: deleteConfirm.cancelDelete,
    goBack: actions.goBack,
  }
}
