import { useChatComposerState } from "./useChatComposerState"
import { useChatHeader } from "./useChatHeader"
import { useChatMessages } from "./useChatMessages"
import { useChatSession } from "./useChatSession"
import { useAccountActionsMenu } from "./useAccountActionsMenu"
import { useChatBackAction } from "./useChatBackAction"
import { useProfileEditorModal } from "./useProfileEditorModal"

export const useChat = () => {
  const session = useChatSession()
  const header = useChatHeader()
  const composer = useChatComposerState()
  const messages = useChatMessages()
  const profileEditor = useProfileEditorModal()
  const accountActions = useAccountActionsMenu()
  const navigation = useChatBackAction()

  return {
    user: session.user,
    chatTitle: header.chatTitle,
    inputDisabled: composer.inputDisabled,
    disabledReason: composer.disabledReason,
    profileEditor,
    accountActions,
    goBack: navigation.goBack,
    ...messages,
  }
}
