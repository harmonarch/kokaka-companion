import type { ChatProfiles } from "@ai-companion/shared"
import { useProfileStore } from "@/stores/profileStore"

export function useProfileSaveAction({
  createProfiles,
  closeProfileEditor,
  setError,
}: {
  createProfiles: () => ChatProfiles
  closeProfileEditor: () => void
  setError: (error: string | null) => void
}) {
  const updateProfiles = useProfileStore((state) => state.updateProfiles)

  async function saveProfile() {
    setError(null)
    try {
      await updateProfiles(createProfiles())
      closeProfileEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    }
  }

  return {
    saveProfile,
  }
}
