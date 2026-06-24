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

  return {
    restoringUser: session.restoringUser,
    hasActiveConversation: session.hasActiveConversation,
    user: session.user,
    chatTitle: header.chatTitle,
    agentStatusText: header.agentStatusText,
    inputDisabled: composer.inputDisabled,
    disabledReason: composer.disabledReason,
    profileEditor,
    ...messages,
  }
}
