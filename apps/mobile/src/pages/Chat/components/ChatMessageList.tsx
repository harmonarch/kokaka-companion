import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import * as Clipboard from "expo-clipboard"
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { useState } from "react"
import type { GestureResponderEvent, ViewStyle } from "react-native"
import type { AppTheme } from "@/theme"
import type { AgentProfile } from "@/stores/conversationStore"
import { useToastStore } from "@/stores/toastStore"
import type { ProfileRole } from "../profile/types"
import { styles } from "../styles"
import { MessageBubble } from "./MessageBubble"

const popoverWidth = 132
const popoverHeight = 42
const popoverMargin = 8
const popoverGap = 18
const arrowSize = 8

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

type ActiveMenu = {
  message: ChatMessage
  x: number
  y: number
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
  onDeleteMessage,
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
  onDeleteMessage: (messageId: string) => Promise<void>
  onLoadOlderHistory: () => Promise<void>
}) {
  const items = createChatListItems(messages)
  const { width } = useWindowDimensions()
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<ChatMessage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const showToast = useToastStore((state) => state.showToast)

  function openMessageMenu(
    message: ChatMessage,
    event: GestureResponderEvent,
  ) {
    setActiveMenu({
      message,
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    })
  }

  function requestDeleteMessage() {
    if (!activeMenu) return
    setDeleteMessage(activeMenu.message)
    setActiveMenu(null)
  }

  async function copyMessage() {
    if (!activeMenu) return
    const content = activeMenu.message.content
    setActiveMenu(null)
    try {
      await Clipboard.setStringAsync(content)
      showToast("已复制")
    } catch {
      showToast("复制失败")
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteMessage || deleting) return
    setDeleting(true)
    try {
      await onDeleteMessage(deleteMessage.id)
      setDeleteMessage(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
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
            onMessageLongPress={openMessageMenu}
          />
        )}
        ListFooterComponent={
          <HistoryLoadingStatus visible={historyLoading} theme={theme} />
        }
        ListEmptyComponent={<EmptyChatState theme={theme} />}
        onEndReached={historyLoaded ? onLoadOlderHistory : undefined}
        onEndReachedThreshold={0.2}
      />
      <MessageActionPopover
        menu={activeMenu}
        screenWidth={width}
        onClose={() => setActiveMenu(null)}
        onCopy={() => void copyMessage()}
        onDelete={requestDeleteMessage}
      />
      <DeleteMessageDialog
        message={deleteMessage}
        loading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteMessage(null)
        }}
        onConfirm={confirmDeleteMessage}
        theme={theme}
      />
    </>
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
  onMessageLongPress,
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
  onMessageLongPress: (
    message: ChatMessage,
    event: GestureResponderEvent,
  ) => void
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
      onLongPress={(event) => onMessageLongPress(item.message, event)}
      onRetry={() => onRetrySend(item.message.id)}
    />
  )
}

function MessageActionPopover({
  menu,
  screenWidth,
  onClose,
  onCopy,
  onDelete,
}: {
  menu: ActiveMenu | null
  screenWidth: number
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  if (!menu) return null

  const left = clamp(
    menu.x - popoverWidth / 2,
    popoverMargin,
    screenWidth - popoverWidth - popoverMargin,
  )
  const showBelow = menu.y - popoverHeight - popoverGap < popoverMargin
  const top = showBelow
    ? menu.y + popoverGap
    : menu.y - popoverHeight - popoverGap
  const arrowLeft = clamp(
    menu.x - left - arrowSize,
    12,
    popoverWidth - arrowSize * 3,
  )

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.popoverLayer}>
        <Pressable style={localStyles.popoverScrim} onPress={onClose} />
        <View
          style={[
            localStyles.popover,
            {
              left,
              top,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制消息"
            onPress={onCopy}
            style={({ pressed }) => [
              localStyles.popoverButton,
              pressed && localStyles.popoverButtonPressed,
              webNoFocusOutline,
            ]}
          >
            <Text style={localStyles.popoverText}>复制</Text>
          </Pressable>
          <View style={localStyles.popoverDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="删除消息"
            onPress={onDelete}
            style={({ pressed }) => [
              localStyles.popoverButton,
              pressed && localStyles.popoverButtonPressed,
              webNoFocusOutline,
            ]}
          >
            <Text style={localStyles.popoverText}>删除</Text>
          </Pressable>
          <View
            style={[
              localStyles.popoverArrow,
              showBelow
                ? localStyles.popoverArrowTop
                : localStyles.popoverArrowBottom,
              {
                left: arrowLeft,
              },
            ]}
          />
        </View>
      </View>
    </Modal>
  )
}

function DeleteMessageDialog({
  message,
  loading,
  onCancel,
  onConfirm,
  theme,
}: {
  message: ChatMessage | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
  theme: AppTheme
}) {
  return (
    <Modal
      visible={message !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={localStyles.modalLayer}>
        <Pressable
          style={localStyles.modalScrim}
          onPress={onCancel}
          disabled={loading}
        />
        <View
          style={[
            localStyles.dialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[localStyles.dialogKicker, { color: theme.subtle }]}>
            删除消息
          </Text>
          <Text style={[localStyles.dialogTitle, { color: theme.text }]}>
            确认删除这条消息？
          </Text>
          <Text style={[localStyles.dialogHint, { color: theme.subtle }]}>
            只会删除聊天记录
          </Text>
          <View style={localStyles.dialogActions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [
                localStyles.cancelButton,
                { borderColor: theme.border },
                pressed &&
                  !loading && {
                    backgroundColor: theme.elevated,
                  },
                loading && localStyles.disabled,
                webNoFocusOutline,
              ]}
            >
              <Text style={[localStyles.cancelText, { color: theme.text }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [
                localStyles.confirmButton,
                { backgroundColor: theme.danger },
                pressed &&
                  !loading && {
                    backgroundColor: theme.danger,
                  },
                loading && localStyles.disabled,
                webNoFocusOutline,
              ]}
            >
              <Text
                style={[localStyles.confirmText, { color: theme.primaryText }]}
              >
                {loading ? "删除中" : "确认删除"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

const localStyles = StyleSheet.create({
  popoverLayer: {
    flex: 1,
  },
  popoverScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  popover: {
    position: "absolute",
    width: popoverWidth,
    height: popoverHeight,
    borderRadius: 6,
    backgroundColor: "#191919",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  popoverButton: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  popoverButtonPressed: {
    opacity: 0.72,
  },
  popoverText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  popoverDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  popoverArrow: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: arrowSize,
    borderRightWidth: arrowSize,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  popoverArrowBottom: {
    bottom: -arrowSize,
    borderTopWidth: arrowSize,
    borderTopColor: "#191919",
  },
  popoverArrowTop: {
    top: -arrowSize,
    borderBottomWidth: arrowSize,
    borderBottomColor: "#191919",
  },
  modalLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  dialogKicker: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  dialogTitle: {
    marginTop: 5,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  dialogHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  confirmButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
})

const webNoFocusOutline: (ViewStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null
