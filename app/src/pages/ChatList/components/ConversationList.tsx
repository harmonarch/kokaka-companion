import { memo, useCallback, useMemo, useState } from "react"
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import type { GestureResponderEvent } from "react-native"
import type { AgentProfile, ChatConversation } from "@/stores/conversationStore"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"
import type { ChatListPalette } from "../types"

const menuWidth = 150
const menuItemHeight = 42
const menuHeight = menuItemHeight * 2
const menuMargin = 8
const menuGap = 14

type ConversationListProps = {
  conversations: ChatConversation[]
  agents: AgentProfile[]
  userAvatarUrl: string | null
  userName: string
  theme: AppTheme
  palette: ChatListPalette
  onOpenConversation: (conversationId: string) => void
  onPinConversation: (conversationId: string) => Promise<void>
  onUnpinConversation: (conversationId: string) => Promise<void>
  onDeleteConversation: (conversationId: string) => Promise<void>
}

type ConversationRowProps = {
  conversation: ChatConversation
  agentById: Map<string, AgentProfile>
  userAvatarUrl: string | null
  userName: string
  theme: AppTheme
  palette: ChatListPalette
  onOpenConversation: (conversationId: string) => void
  onLongPress: (
    conversation: ChatConversation,
    event: GestureResponderEvent,
  ) => void
}

type GroupAvatarMember = {
  id: string
  name: string
  avatar_url?: string | null
}

type ActiveMenu = {
  conversation: ChatConversation
  x: number
  y: number
}

export function ConversationList({
  conversations,
  agents,
  userAvatarUrl,
  userName,
  theme,
  palette,
  onOpenConversation,
  onPinConversation,
  onUnpinConversation,
  onDeleteConversation,
}: ConversationListProps) {
  const { width, height } = useWindowDimensions()
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null)
  const [deleteConversation, setDeleteConversation] =
    useState<ChatConversation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  )
  const emptyState = useMemo(
    () => <EmptyConversationState theme={theme} />,
    [theme],
  )
  const openConversationMenu = useCallback(
    (conversation: ChatConversation, event: GestureResponderEvent) => {
      setActiveMenu({
        conversation,
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      })
    },
    [],
  )
  const renderConversation = useCallback(
    ({ item }: { item: ChatConversation }) => (
      <ConversationRow
        conversation={item}
        agentById={agentById}
        userAvatarUrl={userAvatarUrl}
        userName={userName}
        theme={theme}
        palette={palette}
        onOpenConversation={onOpenConversation}
        onLongPress={openConversationMenu}
      />
    ),
    [
      agentById,
      onOpenConversation,
      openConversationMenu,
      palette,
      theme,
      userAvatarUrl,
      userName,
    ],
  )
  const togglePin = useCallback(async () => {
    const conversation = activeMenu?.conversation
    if (!conversation) return
    setActiveMenu(null)
    if (conversation.pinned_at) {
      await onUnpinConversation(conversation.id)
      return
    }
    await onPinConversation(conversation.id)
  }, [activeMenu, onPinConversation, onUnpinConversation])
  const requestDelete = useCallback(() => {
    if (!activeMenu) return
    setDeleteConversation(activeMenu.conversation)
    setActiveMenu(null)
  }, [activeMenu])
  const confirmDelete = useCallback(async () => {
    if (!deleteConversation || deleting) return
    setDeleting(true)
    try {
      await onDeleteConversation(deleteConversation.id)
      setDeleteConversation(null)
    } finally {
      setDeleting(false)
    }
  }, [deleteConversation, deleting, onDeleteConversation])

  return (
    <>
      <FlatList
        data={conversations}
        keyExtractor={conversationKey}
        style={[styles.list, { backgroundColor: palette.rowSurface }]}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={emptyState}
        renderItem={renderConversation}
      />
      <ConversationActionMenu
        menu={activeMenu}
        screenWidth={width}
        screenHeight={height}
        theme={theme}
        onClose={() => setActiveMenu(null)}
        onTogglePin={togglePin}
        onDelete={requestDelete}
      />
      <DeleteConversationDialog
        conversation={deleteConversation}
        loading={deleting}
        theme={theme}
        onCancel={() => {
          if (!deleting) setDeleteConversation(null)
        }}
        onConfirm={confirmDelete}
      />
    </>
  )
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  agentById,
  userAvatarUrl,
  userName,
  theme,
  palette,
  onOpenConversation,
  onLongPress,
}: ConversationRowProps) {
  const members = conversation.agent_ids
    .map((id) => agentById.get(id))
    .filter((agent): agent is AgentProfile => Boolean(agent))
  const preview =
    conversation.type === "group"
      ? members.map((agent) => agent.name).join("、")
      : members[0]?.persona_prompt || "还没有消息"
  const avatar =
    conversation.type === "single" ? members[0]?.avatar_url?.trim() || "" : ""
  const groupMembers = createGroupAvatarMembers({
    members,
    userAvatarUrl,
    userName,
  })

  return (
    <Pressable
      onPress={() => onOpenConversation(conversation.id)}
      onLongPress={(event) => onLongPress(conversation, event)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? palette.rowPressed : palette.rowSurface,
        },
      ]}
    >
      <View
        style={[
          styles.avatar,
          {
            backgroundColor:
              conversation.type === "group" ? "#dfe3e0" : "#d8c18b",
          },
        ]}
      >
        {conversation.type === "group" ? (
          <GroupAvatar members={groupMembers} />
        ) : avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>
            {conversation.title.slice(0, 1)}
          </Text>
        )}
      </View>
      <View style={[styles.rowContent, { borderColor: theme.softBorder }]}>
        <View style={styles.rowTitleLine}>
          <Text
            numberOfLines={1}
            style={[styles.rowTitle, { color: theme.text }]}
          >
            {conversation.title}
          </Text>
          <Text style={[styles.rowTime, { color: theme.subtle }]}>
            {formatConversationTime(conversation.updated_at)}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.rowPreview, { color: theme.muted }]}
        >
          {conversation.last_message || preview}
        </Text>
      </View>
    </Pressable>
  )
})

function EmptyConversationState({ theme }: { theme: AppTheme }) {
  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyText, { color: theme.subtle }]}>
        还没有聊天
      </Text>
    </View>
  )
}

function ConversationActionMenu({
  menu,
  screenWidth,
  screenHeight,
  theme,
  onClose,
  onTogglePin,
  onDelete,
}: {
  menu: ActiveMenu | null
  screenWidth: number
  screenHeight: number
  theme: AppTheme
  onClose: () => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  if (!menu) return null

  const left = clamp(
    menu.x - menuWidth / 2,
    menuMargin,
    Math.max(menuMargin, screenWidth - menuWidth - menuMargin),
  )
  const top = clamp(
    menu.y + menuGap,
    menuMargin,
    Math.max(menuMargin, screenHeight - menuHeight - menuMargin),
  )
  const pinned = Boolean(menu.conversation.pinned_at)

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionLayer}>
        <Pressable style={styles.actionScrim} onPress={onClose} />
        <View
          style={[
            styles.actionMenu,
            {
              left,
              top,
              backgroundColor: theme.mode === "dark" ? "#2b2b2b" : "#4c4c4c",
            },
          ]}
        >
          <ActionMenuButton
            label={pinned ? "取消置顶" : "置顶"}
            onPress={onTogglePin}
          />
          <ActionMenuButton label="删除该聊天" destructive onPress={onDelete} />
        </View>
      </View>
    </Modal>
  )
}

function ActionMenuButton({
  label,
  destructive,
  onPress,
}: {
  label: string
  destructive?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionMenuItem,
        pressed && styles.actionMenuItemPressed,
      ]}
    >
      <Text
        style={[
          styles.actionMenuText,
          destructive && styles.actionMenuDestructiveText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function DeleteConversationDialog({
  conversation,
  loading,
  theme,
  onCancel,
  onConfirm,
}: {
  conversation: ChatConversation | null
  loading: boolean
  theme: AppTheme
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      visible={conversation !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.deleteLayer}>
        <Pressable
          style={styles.deleteScrim}
          onPress={onCancel}
          disabled={loading}
        />
        <View
          style={[
            styles.deleteDialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.deleteKicker, { color: theme.subtle }]}>
            删除聊天
          </Text>
          <Text style={[styles.deleteTitle, { color: theme.text }]}>
            确认删除这个聊天？
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.deleteHint, { color: theme.subtle }]}
          >
            {conversation?.title ?? ""} 的聊天记录也会一起删除
          </Text>
          <View style={styles.deleteActions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [
                styles.deleteCancelButton,
                { borderColor: theme.border },
                pressed &&
                  !loading && {
                    backgroundColor: theme.elevated,
                  },
                loading && styles.disabled,
              ]}
            >
              <Text style={[styles.deleteCancelText, { color: theme.text }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.deleteConfirmButton,
                { backgroundColor: theme.danger },
                loading && styles.disabled,
              ]}
            >
              <Text
                style={[styles.deleteConfirmText, { color: theme.primaryText }]}
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

function GroupAvatar({ members }: { members: GroupAvatarMember[] }) {
  const visibleMembers = members.slice(0, 9)
  const count = visibleMembers.length

  return (
    <View style={styles.groupAvatarGrid}>
      {visibleMembers.map((member, index) => (
        <View
          key={`${member.id}:${index}`}
          style={[
            styles.groupAvatarTile,
            getGroupAvatarTileStyle(count, index),
          ]}
        >
          {member.avatar_url ? (
            <Image
              source={{ uri: member.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.groupAvatarText}>
              {(member.name || "我").slice(0, 1)}
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}

function createGroupAvatarMembers({
  members,
  userAvatarUrl,
  userName,
}: {
  members: AgentProfile[]
  userAvatarUrl: string | null
  userName: string
}): GroupAvatarMember[] {
  return [
    { id: "user", name: userName || "我", avatar_url: userAvatarUrl },
    ...members.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar_url: agent.avatar_url,
    })),
  ]
}

function getGroupAvatarTileStyle(count: number, index: number) {
  const size = count <= 4 ? 18 : 12
  const gap = count <= 4 ? 3 : 2
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const rows = Math.ceil(count / columns)
  const lastRowCount = count % columns || columns
  const row = Math.floor(index / columns)
  const column = index % columns
  const rowCount = row === rows - 1 ? lastRowCount : columns
  const totalWidth = rowCount * size + (rowCount - 1) * gap
  const totalHeight = rows * size + (rows - 1) * gap
  const rowStart = (48 - totalWidth) / 2
  const topStart = (48 - totalHeight) / 2

  return {
    width: size,
    height: size,
    left: rowStart + column * (size + gap),
    top: topStart + row * (size + gap),
  }
}

function conversationKey(conversation: ChatConversation) {
  return conversation.id
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatConversationTime(value: number) {
  if (value <= 1) return ""
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
