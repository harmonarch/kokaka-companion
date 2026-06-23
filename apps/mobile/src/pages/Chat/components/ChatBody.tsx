import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import { View } from "react-native"
import type { AppTheme } from "@/theme"
import type { AgentProfile } from "@/stores/conversationStore"
import type { ProfileRole } from "../profile/types"
import { styles } from "../styles"
import { ChatErrorMessage } from "./ChatErrorMessage"
import { ChatInput } from "./ChatInput"
import { ChatMessageList } from "./ChatMessageList"

export function ChatBody({
  messages,
  profiles,
  agentAvatarUrl,
  conversationAgents,
  showAgentNames,
  error,
  historyLoading,
  historyLoaded,
  inputDisabled,
  disabledReason,
  failedMessageIds,
  theme,
  onAvatarPress,
  onLoadOlderHistory,
  onTyping,
  onSend,
  onRetrySend,
  onDeleteMessage,
}: {
  messages: ChatMessage[]
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  conversationAgents: AgentProfile[]
  showAgentNames: boolean
  error: string | null
  historyLoading: boolean
  historyLoaded: boolean
  inputDisabled: boolean
  disabledReason: string | undefined
  failedMessageIds: Set<string>
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
  onLoadOlderHistory: () => Promise<void>
  onTyping: () => void
  onSend: (content: string) => Promise<void>
  onRetrySend: (messageId: string) => Promise<void>
  onDeleteMessage: (messageId: string) => Promise<void>
}) {
  return (
    <View style={styles.chatBody}>
      <ChatMessageList
        messages={messages}
        profiles={profiles}
        agentAvatarUrl={agentAvatarUrl}
        conversationAgents={conversationAgents}
        showAgentNames={showAgentNames}
        historyLoading={historyLoading}
        historyLoaded={historyLoaded}
        failedMessageIds={failedMessageIds}
        theme={theme}
        onAvatarPress={onAvatarPress}
        onRetrySend={onRetrySend}
        onDeleteMessage={onDeleteMessage}
        onLoadOlderHistory={onLoadOlderHistory}
      />
      <ChatErrorMessage error={error} theme={theme} />
      <ChatInput
        disabled={inputDisabled}
        disabledReason={disabledReason}
        onTyping={onTyping}
        onSend={onSend}
        theme={theme}
      />
    </View>
  )
}
