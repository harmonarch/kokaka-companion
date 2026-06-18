import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Redirect, router } from "expo-router"
import { useAppTheme, type AppTheme } from "@/theme"
import { useChat } from "@/pages/Chat/hooks/useChat"
import { ChatInput } from "./components/ChatInput"
import { MessageBubble } from "./components/MessageBubble"
import { ProfileEditorModal } from "./components/ProfileEditorModal"
import type { ProfileRole } from "./profile/types"

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

type ChatHeaderProps = {
  title: string
  statusText: string | null
  theme: AppTheme
  onBack: () => void
}

type ChatBodyProps = {
  messages: ChatMessage[]
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  error: string | null
  historyLoading: boolean
  historyLoaded: boolean
  inputDisabled: boolean
  disabledReason: string | undefined
  failedMessageIds: Set<string>
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
  onLoadOlderHistory: () => Promise<void>
  onSend: (content: string) => Promise<void>
  onRetrySend: (messageId: string) => Promise<void>
}

type ChatMessageListProps = {
  items: ChatListItem[]
  isEmpty: boolean
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  historyLoading: boolean
  historyLoaded: boolean
  theme: AppTheme
  failedMessageIds: Set<string>
  onAvatarPress: (role: ProfileRole) => void
  onRetrySend: (messageId: string) => Promise<void>
  onLoadOlderHistory: () => Promise<void>
}

type ChatOverlaysProps = {
  profileEditor: ReturnType<typeof useChat>["profileEditor"]
  theme: AppTheme
}

type ChatListRowProps = {
  item: ChatListItem
  profiles: ChatProfiles
  agentAvatarUrl: string | null
  theme: AppTheme
  failedMessageIds: Set<string>
  onAvatarPress: (role: ProfileRole) => void
  onRetrySend: (messageId: string) => Promise<void>
}

type DateSeparatorProps = {
  label: string
  theme: AppTheme
}

type ThemedVisibilityProps = {
  visible: boolean
  theme: AppTheme
}

type ThemedStatusProps = {
  error: string | null
  theme: AppTheme
}

export default function Chat() {
  const theme = useAppTheme()
  const chat = useChat()

  if (chat.restoringUser) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  if (!chat.user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <ChatHeader
          title={chat.chatTitle}
          statusText={chat.agentStatusText}
          theme={theme}
          onBack={() => router.replace("/chats")}
        />
        <ChatBody
          messages={chat.messages}
          profiles={chat.profiles}
          agentAvatarUrl={chat.agentAvatarUrl}
          error={chat.error}
          historyLoading={chat.historyLoading}
          historyLoaded={chat.historyLoaded}
          inputDisabled={chat.inputDisabled}
          disabledReason={chat.disabledReason}
          failedMessageIds={chat.failedMessageIds}
          theme={theme}
          onAvatarPress={chat.profileEditor.openProfileEditor}
          onLoadOlderHistory={chat.loadOlderHistory}
          onSend={chat.send}
          onRetrySend={chat.retrySend}
        />
        <ChatOverlays profileEditor={chat.profileEditor} theme={theme} />
      </View>
    </View>
  )
}

function ChatHeader({ title, statusText, theme, onBack }: ChatHeaderProps) {
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <Pressable onPress={onBack} style={styles.iconButton}>
        <Text style={[styles.backText, { color: theme.text }]}>‹</Text>
      </Pressable>
      <View style={styles.headerTitle}>
        <Text style={[styles.title, { color: theme.accent }]}>{title}</Text>
        {statusText ? (
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {statusText}
          </Text>
        ) : null}
      </View>
      <View style={styles.iconButton} />
    </View>
  )
}

function ChatBody({
  messages,
  profiles,
  agentAvatarUrl,
  error,
  historyLoading,
  historyLoaded,
  inputDisabled,
  disabledReason,
  failedMessageIds,
  theme,
  onAvatarPress,
  onLoadOlderHistory,
  onSend,
  onRetrySend,
}: ChatBodyProps) {
  const listItems = createChatListItems(messages)

  return (
    <View style={styles.chatBody}>
      <ChatMessageList
        items={listItems}
        isEmpty={messages.length === 0}
        profiles={profiles}
        agentAvatarUrl={agentAvatarUrl}
        historyLoading={historyLoading}
        historyLoaded={historyLoaded}
        failedMessageIds={failedMessageIds}
        theme={theme}
        onAvatarPress={onAvatarPress}
        onRetrySend={onRetrySend}
        onLoadOlderHistory={onLoadOlderHistory}
      />
      <ChatErrorMessage error={error} theme={theme} />
      <ChatInput
        disabled={inputDisabled}
        disabledReason={disabledReason}
        onSend={onSend}
        theme={theme}
      />
    </View>
  )
}

function ChatMessageList({
  items,
  isEmpty,
  profiles,
  agentAvatarUrl,
  historyLoading,
  historyLoaded,
  failedMessageIds,
  theme,
  onAvatarPress,
  onRetrySend,
  onLoadOlderHistory,
}: ChatMessageListProps) {
  return (
    <FlatList
      inverted
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        isEmpty && styles.emptyListContent,
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
  failedMessageIds,
  theme,
  onAvatarPress,
  onRetrySend,
}: ChatListRowProps) {
  if (item.type === "date") {
    return <DateSeparator label={item.label} theme={theme} />
  }

  return (
    <MessageBubble
      message={item.message}
      profiles={profiles}
      agentAvatarUrl={agentAvatarUrl}
      failed={failedMessageIds.has(item.message.id)}
      theme={theme}
      onAvatarPress={onAvatarPress}
      onRetry={() => onRetrySend(item.message.id)}
    />
  )
}

function DateSeparator({ label, theme }: DateSeparatorProps) {
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

function HistoryLoadingStatus({ visible, theme }: ThemedVisibilityProps) {
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

function ChatErrorMessage({ error, theme }: ThemedStatusProps) {
  if (!error) return null

  return <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
}

function ChatOverlays({ profileEditor, theme }: ChatOverlaysProps) {
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "300",
    marginTop: -2,
  },
  list: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  historyStatus: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateSeparator: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 26,
    paddingVertical: 32,
  },
  emptyListInversionFix: {
    transform: [{ scaleY: -1 }],
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
})
