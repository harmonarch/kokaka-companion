import type { AppTheme } from "@/theme"
import type { useChat } from "../hooks/useChat"
import { ProfileEditorModal } from "./ProfileEditorModal"

export function ChatOverlays({
  profileEditor,
  theme,
}: {
  profileEditor: ReturnType<typeof useChat>["profileEditor"]
  theme: AppTheme
}) {
  return (
    <ProfileEditorModal
      role={profileEditor.activeRole}
      profile={profileEditor.activeProfile}
      error={profileEditor.error}
      onClose={profileEditor.closeProfileEditor}
      onSave={profileEditor.saveProfile}
      theme={theme}
    />
  )
}
