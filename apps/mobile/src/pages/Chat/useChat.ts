import { useChatComposerState } from "./useChatComposerState"
import { useChatHeader } from "./useChatHeader"
import { useChatMessages } from "./useChatMessages"
import { useChatSession } from "./useChatSession"

export const useChat = () => {
  const session = useChatSession()
  const header = useChatHeader()
  const composer = useChatComposerState()
  const messages = useChatMessages()

  return {
    user: session.user,
    chatTitle: header.chatTitle,
    inputDisabled: composer.inputDisabled,
    disabledReason: composer.disabledReason,
    ...messages,
  }
}
