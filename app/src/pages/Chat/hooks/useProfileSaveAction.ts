import type { ChatProfiles } from "@ai-companion/shared"
import { useProfileStore } from "@/stores/profileStore"
import { useToastStore } from "@/stores/toastStore"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"

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
  const showToast = useToastStore((state) => state.showToast)

  async function saveProfile() {
    setError(null)
    try {
      await updateProfiles(createProfiles())
      closeProfileEditor()
    } catch (err) {
      const networkError = getNetworkErrorMessage(err)
      if (networkError) showToast(networkError)
      setError(getReadableErrorMessage(err, "保存失败"))
    }
  }

  return {
    saveProfile,
  }
}
