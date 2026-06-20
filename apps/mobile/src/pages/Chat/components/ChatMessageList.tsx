import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import { FlatList, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import type { AgentProfile } from "@/stores/conversationStore"
import type { ProfileRole } from "../profile/types"
import { styles } from "../styles"
import { MessageBubble } from "./MessageBubble"

type ChatListItem =
  | {
      type: "message"
      message: ChatMessage
    }
  | {
      type: "date"
      id: string
      label: string
    }

export function ChatMessageList({
  messages,
  profiles,
  agentAvatarUrl,
  conversationAgents,
  showAgentNames,
  historyLoading,
  historyLoaded,
  failedMessageIds,
  theme,
  onAvatarPress,
  onRetrySend,
  onLoadOlderHistory,
}: {
  messages: ChatMessage[]
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  conversationAgents: AgentProfile[]
  showAgentNames: boolean
  historyLoading: boolean
  historyLoaded: boolean
  failedMessageIds: Set<string>
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
  onRetrySend: (messageId: string) => Promise<void>
  onLoadOlderHistory: () => Promise<void>
}) {
  const items = createChatListItems(messages)

  return (
    <FlatList
      inverted
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        messages.length === 0 && styles.emptyListContent,
      ]}
      data={items}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyExtractor={chatListItemKey}
      renderItem={({ item }) => (
        <ChatListRow
          item={item}
          profiles={profiles}
          agentAvatarUrl={agentAvatarUrl}
          conversationAgents={conversationAgents}
          showAgentNames={showAgentNames}
          failedMessageIds={failedMessageIds}
          theme={theme}
          onAvatarPress={onAvatarPress}
          onRetrySend={onRetrySend}
        />
      )}
      ListFooterComponent={
        <HistoryLoadingStatus visible={historyLoading} theme={theme} />
      }
      ListEmptyComponent={<EmptyChatState theme={theme} />}
      onEndReached={historyLoaded ? onLoadOlderHistory : undefined}
      onEndReachedThreshold={0.2}
    />
  )
}

function ChatListRow({
  item,
  profiles,
  agentAvatarUrl,
  conversationAgents,
  showAgentNames,
  failedMessageIds,
  theme,
  onAvatarPress,
  onRetrySend,
}: {
  item: ChatListItem
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  conversationAgents: AgentProfile[]
  showAgentNames: boolean
  theme: AppTheme
  failedMessageIds: Set<string>
  onAvatarPress: (role: ProfileRole) => void
  onRetrySend: (messageId: string) => Promise<void>
}) {
  if (item.type === "date") {
    return <DateSeparator label={item.label} theme={theme} />
  }

  return (
    <MessageBubble
      message={item.message}
      profiles={profiles}
      agentAvatarUrl={agentAvatarUrl}
      conversationAgents={conversationAgents}
      showAgentNames={showAgentNames}
      failed={failedMessageIds.has(item.message.id)}
      theme={theme}
      onAvatarPress={onAvatarPress}
      onRetry={() => onRetrySend(item.message.id)}
    />
  )
}

function DateSeparator({ label, theme }: { label: string; theme: AppTheme }) {
  return (
    <Text
      style={[
        styles.dateSeparator,
        {
          backgroundColor: theme.border,
          color: theme.surface,
        },
      ]}
    >
      {label}
    </Text>
  )
}

function HistoryLoadingStatus({
  visible,
  theme,
}: {
  visible: boolean
  theme: AppTheme
}) {
  if (!visible) return null

  return (
    <Text
      style={[
        styles.historyStatus,
        {
          backgroundColor: theme.border,
          color: theme.surface,
        },
      ]}
    >
      正在载入更早的聊天
    </Text>
  )
}

function EmptyChatState({ theme }: { theme: AppTheme }) {
  return (
    <View
      style={[
        styles.empty,
        styles.emptyListInversionFix,
        { backgroundColor: theme.surface },
      ]}
    >
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        可以从一句很小的话开始。
      </Text>
      <Text style={[styles.emptyText, { color: theme.muted }]}>
        例如：今天有点累，但我还说不清楚。
      </Text>
    </View>
  )
}

function chatListItemKey(item: ChatListItem) {
  return item.type === "message" ? item.message.id : item.id
}

function createChatListItems(messages: ChatMessage[]): ChatListItem[] {
  return messages.flatMap((message, index) => {
    const dayKey = getDateKey(message.created_at)
    const nextMessage = messages[index + 1]
    const isOldestMessageOfDay =
      !nextMessage || getDateKey(nextMessage.created_at) !== dayKey

    if (!isOldestMessageOfDay) {
      return [{ type: "message", message }]
    }

    return [
      { type: "message", message },
      {
        type: "date",
        id: `date:${dayKey}`,
        label: formatMessageDate(message.created_at),
      },
    ]
  })
}

function getDateKey(value: number) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatMessageDate(value: number) {
  const date = new Date(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
