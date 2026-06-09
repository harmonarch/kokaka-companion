import { useState } from "react"
import type { ProfileRole } from "../profile/types"

export function useProfileEditorState(onReset: () => void) {
  const [activeRole, setActiveRole] = useState<ProfileRole | null>(null)

  function openProfileEditor(role: ProfileRole) {
    onReset()
    setActiveRole(role)
  }

  function closeProfileEditor() {
    onReset()
    setActiveRole(null)
  }

  return {
    activeRole,
    openProfileEditor,
    closeProfileEditor,
  }
}
