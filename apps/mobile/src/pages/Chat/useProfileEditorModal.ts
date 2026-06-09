import {
  useEditableChatProfile,
  type EditableChatProfile,
} from "./profile/useEditableChatProfile"
import type { ProfileRole } from "./profile/types"
import { useChatProfilesForm } from "./profile/useChatProfilesForm"
import { useProfileEditorError } from "./profile/useProfileEditorError"
import { useProfileEditorState } from "./hooks/useProfileEditorState"
import { useProfileSaveAction } from "./hooks/useProfileSaveAction"

export function useProfileEditorModal() {
  const editorError = useProfileEditorError()
  const editorState = useProfileEditorState(() => editorError.setError(null))
  const profiles = useChatProfilesForm({
    onError: editorError.setError,
  })
  const saveAction = useProfileSaveAction({
    createProfiles: profiles.createProfiles,
    closeProfileEditor: editorState.closeProfileEditor,
    setError: editorError.setError,
  })

  const activeProfile = editorState.activeRole
    ? getProfileByRole(
        editorState.activeRole,
        profiles.userProfile,
        profiles.agentProfile,
      )
    : null

  return {
    activeRole: editorState.activeRole,
    activeProfile,
    error: editorError.error,
    openProfileEditor: editorState.openProfileEditor,
    closeProfileEditor: editorState.closeProfileEditor,
    saveProfile: saveAction.saveProfile,
  }
}

function getProfileByRole(
  role: ProfileRole,
  userProfile: EditableChatProfile,
  agentProfile: EditableChatProfile,
) {
  return role === "user" ? userProfile : agentProfile
}
