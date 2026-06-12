import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { Redirect } from "expo-router"
import { useAppTheme, type AppTheme } from "@/theme"
import { useChat } from "@/pages/Chat/hooks/useChat"
import { AccountActionsMenu } from "./components/AccountActionsMenu"
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
  onOpenAccountMenu: () => void
}

type ChatBodyProps = {
  messages: ChatMessage[]
  profiles: ChatProfiles
  error: string | null
  historyLoading: boolean
  historyLoaded: boolean
  inputDisabled: boolean
  disabledReason: string | undefined
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
  onLoadOlderHistory: () => Promise<void>
  onSend: (content: string) => void
}

type ChatMessageListProps = {
  items: ChatListItem[]
  isEmpty: boolean
  profiles: ChatProfiles
  historyLoading: boolean
  historyLoaded: boolean
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
  onLoadOlderHistory: () => Promise<void>
}

type ChatOverlaysProps = {
  profileEditor: ReturnType<typeof useChat>["profileEditor"]
  accountActions: ReturnType<typeof useChat>["accountActions"]
  theme: AppTheme
}

type ChatListRowProps = {
  item: ChatListItem
  profiles: ChatProfiles
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
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

  if (!chat.user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <ChatHeader
          title={chat.chatTitle}
          statusText={chat.agentStatusText}
          theme={theme}
          onOpenAccountMenu={chat.accountActions.openMenu}
        />
        <ChatBody
          messages={chat.messages}
          profiles={chat.profiles}
          error={chat.error}
          historyLoading={chat.historyLoading}
          historyLoaded={chat.historyLoaded}
          inputDisabled={chat.inputDisabled}
          disabledReason={chat.disabledReason}
          theme={theme}
          onAvatarPress={chat.profileEditor.openProfileEditor}
          onLoadOlderHistory={chat.loadOlderHistory}
          onSend={chat.send}
        />
        <ChatOverlays
          profileEditor={chat.profileEditor}
          accountActions={chat.accountActions}
          theme={theme}
        />
      </View>
    </View>
  )
}

function ChatHeader({
  title,
  statusText,
  theme,
  onOpenAccountMenu,
}: ChatHeaderProps) {
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <View style={styles.iconButton} />
      <View style={styles.headerTitle}>
        <Text style={[styles.title, { color: theme.accent }]}>{title}</Text>
        {statusText ? (
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {statusText}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onOpenAccountMenu} style={styles.iconButton}>
        <Text style={[styles.moreText, { color: theme.text }]}>···</Text>
      </Pressable>
    </View>
  )
}

function ChatBody({
  messages,
  profiles,
  error,
  historyLoading,
  historyLoaded,
  inputDisabled,
  disabledReason,
  theme,
  onAvatarPress,
  onLoadOlderHistory,
  onSend,
}: ChatBodyProps) {
  const listItems = createChatListItems(messages)

  return (
    <View style={styles.chatBody}>
      <ChatMessageList
        items={listItems}
        isEmpty={messages.length === 0}
        profiles={profiles}
        historyLoading={historyLoading}
        historyLoaded={historyLoaded}
        theme={theme}
        onAvatarPress={onAvatarPress}
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
  historyLoading,
  historyLoaded,
  theme,
  onAvatarPress,
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
          theme={theme}
          onAvatarPress={onAvatarPress}
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
  theme,
  onAvatarPress,
}: ChatListRowProps) {
  if (item.type === "date") {
    return <DateSeparator label={item.label} theme={theme} />
  }

  return (
    <MessageBubble
      message={item.message}
      profiles={profiles}
      theme={theme}
      onAvatarPress={onAvatarPress}
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

function HistoryLoadingStatus({
  visible,
  theme,
}: ThemedVisibilityProps) {
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
    <View style={[styles.empty, { backgroundColor: theme.surface }]}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        可以从一句很小的话开始。
      </Text>
      <Text style={[styles.emptyText, { color: theme.muted }]}>
        例如：今天有点累，但我还说不清楚。
      </Text>
    </View>
  )
}

function ChatErrorMessage({
  error,
  theme,
}: ThemedStatusProps) {
  if (!error) return null

  return <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
}

function ChatOverlays({
  profileEditor,
  accountActions,
  theme,
}: ChatOverlaysProps) {
  return (
    <>
      <ProfileEditorModal
        role={profileEditor.activeRole}
        profile={profileEditor.activeProfile}
        error={profileEditor.error}
        onClose={profileEditor.closeProfileEditor}
        onSave={profileEditor.saveProfile}
        theme={theme}
      />
      <AccountActionsMenu
        visible={accountActions.visible}
        confirmDelete={accountActions.confirmDelete}
        onClose={accountActions.closeMenu}
        onOpenMemories={accountActions.openMemoryManager}
        onSignOut={accountActions.signOut}
        onRemove={accountActions.remove}
        theme={theme}
      />
    </>
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
  iconText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "300",
  },
  moreText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: -7,
  },
  list: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
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
