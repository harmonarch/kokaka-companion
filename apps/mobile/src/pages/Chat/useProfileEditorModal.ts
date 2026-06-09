import type { ChatProfiles } from "@ai-companion/shared"
import { useState } from "react"
import { useProfileStore } from "@/stores/profileStore"
import {
  useEditableChatProfile,
  type EditableChatProfile,
} from "@/pages/Settings/useEditableChatProfile"
import type { ProfileRole } from "@/pages/Settings/types"
import { useSettingsError } from "@/pages/Settings/useSettingsError"

export function useProfileEditorModal() {
  const [activeRole, setActiveRole] = useState<ProfileRole | null>(null)
  const updateProfiles = useProfileStore((state) => state.updateProfiles)
  const settingsError = useSettingsError()
  const userProfile = useEditableChatProfile({
    role: "user",
    onError: settingsError.setError,
  })
  const agentProfile = useEditableChatProfile({
    role: "agent",
    onError: settingsError.setError,
  })

  const activeProfile = activeRole
    ? getProfileByRole(activeRole, userProfile, agentProfile)
    : null

  function openProfileEditor(role: ProfileRole) {
    settingsError.setError(null)
    setActiveRole(role)
  }

  function closeProfileEditor() {
    settingsError.setError(null)
    setActiveRole(null)
  }

  async function saveProfile() {
    if (!activeRole) return
    settingsError.setError(null)
    try {
      const profiles: ChatProfiles = {
        user: userProfile.createProfile(),
        agent: agentProfile.createProfile(),
      }
      await updateProfiles(profiles)
      setActiveRole(null)
    } catch (err) {
      settingsError.setError(err instanceof Error ? err.message : "保存失败")
    }
  }

  return {
    activeRole,
    activeProfile,
    error: settingsError.error,
    openProfileEditor,
    closeProfileEditor,
    saveProfile,
  }
}

function getProfileByRole(
  role: ProfileRole,
  userProfile: EditableChatProfile,
  agentProfile: EditableChatProfile,
) {
  return role === "user" ? userProfile : agentProfile
}
