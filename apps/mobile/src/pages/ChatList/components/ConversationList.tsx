import { memo, useCallback, useMemo } from "react"
import { FlatList, Image, Pressable, Text, View } from "react-native"
import type { AgentProfile, ChatConversation } from "@/stores/conversationStore"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"
import type { ChatListPalette } from "../types"

type ConversationListProps = {
  conversations: ChatConversation[]
  agents: AgentProfile[]
  userAvatarUrl: string | null
  userName: string
  theme: AppTheme
  palette: ChatListPalette
  onOpenConversation: (conversationId: string) => void
}

type ConversationRowProps = {
  conversation: ChatConversation
  agentById: Map<string, AgentProfile>
  userAvatarUrl: string | null
  userName: string
  theme: AppTheme
  palette: ChatListPalette
  onOpenConversation: (conversationId: string) => void
}

type GroupAvatarMember = {
  id: string
  name: string
  avatar_url?: string | null
}

export function ConversationList({
  conversations,
  agents,
  userAvatarUrl,
  userName,
  theme,
  palette,
  onOpenConversation,
}: ConversationListProps) {
  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  )
  const emptyState = useMemo(
    () => <EmptyConversationState theme={theme} />,
    [theme],
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
      />
    ),
    [agentById, onOpenConversation, palette, theme, userAvatarUrl, userName],
  )

  return (
    <FlatList
      data={conversations}
      keyExtractor={conversationKey}
      style={[styles.list, { backgroundColor: palette.rowSurface }]}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={emptyState}
      renderItem={renderConversation}
    />
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

function formatConversationTime(value: number) {
  if (value <= 1) return ""
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
