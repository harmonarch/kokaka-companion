import { useCallback } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useChatComposerState } from "./useChatComposerState"
import { useChatHeader } from "./useChatHeader"
import { useChatMessages } from "./useChatMessages"
import { useChatSession } from "./useChatSession"
import { useProfileEditorModal } from "./useProfileEditorModal"

export const useChat = () => {
  const session = useChatSession()
  const header = useChatHeader()
  const composer = useChatComposerState()
  const messages = useChatMessages()
  const profileEditor = useProfileEditorModal()
  const transcribeRecording = useCallback(
    async (audio: Blob, signal?: AbortSignal) => {
      const response = await useAuthStore
        .getState()
        .client.transcribeAudio(audio, signal)
      return response.text
    },
    [],
  )

  return {
    restoringUser: session.restoringUser,
    hasActiveConversation: session.hasActiveConversation,
    user: session.user,
    chatTitle: header.chatTitle,
    agentStatusText: header.agentStatusText,
    inputDisabled: composer.inputDisabled,
    disabledReason: composer.disabledReason,
    transcribeRecording,
    profileEditor,
    ...messages,
  }
}
