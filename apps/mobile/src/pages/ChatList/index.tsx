import { Redirect, router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useAuthStore } from "@/stores/authStore"
import {
  type AgentProfile,
  type ChatConversation,
  useConversationStore,
} from "@/stores/conversationStore"
import { useAppTheme, type AppTheme } from "@/theme"
import { pickAvatarImage } from "@/pages/Chat/profile/pickAvatarImage"

export default function ChatList() {
  const theme = useAppTheme()
  const ready = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const hydrate = useConversationStore((state) => state.hydrate)
  const conversationsReady = useConversationStore((state) => state.ready)
  const conversations = useConversationStore((state) => state.conversations)
  const agents = useConversationStore((state) => state.agents)
  const userAvatarUrl = useConversationStore((state) => state.userAvatarUrl)
  const userName = useConversationStore((state) => state.userName)
  const createAgent = useConversationStore((state) => state.createAgent)
  const createGroup = useConversationStore((state) => state.createGroup)
  const setActiveConversation = useConversationStore(
    (state) => state.setActiveConversation,
  )
  const [createMenuVisible, setCreateMenuVisible] = useState(false)
  const [agentModalVisible, setAgentModalVisible] = useState(false)
  const [groupModalVisible, setGroupModalVisible] = useState(false)

  useEffect(() => {
    if (user) void hydrate()
  }, [hydrate, user])

  if (!ready || (user && !conversationsReady)) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  if (!user) return <Redirect href="/login" />

  function openConversation(conversationId: string) {
    setActiveConversation(conversationId)
    router.push("/chat")
  }

  async function saveAgent(input: {
    name: string
    personaPrompt: string
    avatarUrl?: string | null
    copyPersonaPrompt?: boolean
  }) {
    const conversationId = await createAgent(input)
    setActiveConversation(conversationId)
    setAgentModalVisible(false)
    router.push("/chat")
  }

  async function saveGroup(input: { title: string; agentIds: string[] }) {
    const conversationId = await createGroup(input)
    setActiveConversation(conversationId)
    setGroupModalVisible(false)
    router.push("/chat")
  }

  function openAgentCreator() {
    setCreateMenuVisible(false)
    setAgentModalVisible(true)
  }

  function openGroupCreator() {
    setCreateMenuVisible(false)
    setGroupModalVisible(true)
  }

  const listBackground = theme.mode === "dark" ? "#111111" : "#ededed"
  const navigationBar = theme.mode === "dark" ? "#1f1f1f" : "#ededed"
  const rowSurface = theme.mode === "dark" ? "#1b1b1b" : "#ffffff"
  const rowPressed = theme.mode === "dark" ? "#252525" : "#f5f5f5"

  return (
    <View style={[styles.page, { backgroundColor: listBackground }]}>
      <View style={styles.shell}>
        <View
          style={[
            styles.header,
            { backgroundColor: navigationBar, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]}>聊天</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setCreateMenuVisible(true)}
              style={({ pressed }) => [
                styles.headerButton,
                {
                  backgroundColor: pressed
                    ? theme.mode === "dark"
                      ? "#2b2b2b"
                      : "#dedede"
                    : "transparent",
                },
              ]}
            >
              <Text style={[styles.headerButtonText, { color: theme.text }]}>
                ＋
              </Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          style={[styles.list, { backgroundColor: rowSurface }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.subtle }]}>
                还没有聊天
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              agents={agents}
              userAvatarUrl={userAvatarUrl}
              userName={userName || user.nickname || "我"}
              theme={theme}
              rowSurface={rowSurface}
              rowPressed={rowPressed}
              onPress={() => openConversation(item.id)}
            />
          )}
        />
        <BottomTabs active="chats" theme={theme} />
      </View>
      <CreateMenuModal
        visible={createMenuVisible}
        theme={theme}
        onClose={() => setCreateMenuVisible(false)}
        onCreateSingle={openAgentCreator}
        onCreateGroup={openGroupCreator}
      />
      <AddAgentModal
        visible={agentModalVisible}
        theme={theme}
        onClose={() => setAgentModalVisible(false)}
        onSave={saveAgent}
      />
      <CreateGroupModal
        visible={groupModalVisible}
        agents={agents}
        theme={theme}
        onClose={() => setGroupModalVisible(false)}
        onSave={saveGroup}
      />
    </View>
  )
}

function ConversationRow({
  conversation,
  agents,
  userAvatarUrl,
  userName,
  theme,
  rowSurface,
  rowPressed,
  onPress,
}: {
  conversation: ChatConversation
  agents: AgentProfile[]
  userAvatarUrl: string | null
  userName: string
  theme: AppTheme
  rowSurface: string
  rowPressed: string
  onPress: () => void
}) {
  const members = conversation.agent_ids
    .map((id) => agents.find((agent) => agent.id === id))
    .filter((agent): agent is AgentProfile => Boolean(agent))
  const preview =
    conversation.type === "group"
      ? members.map((agent) => agent.name).join("、")
      : members[0]?.persona_prompt || "还没有消息"
  const avatar =
    conversation.type === "single" ? members[0]?.avatar_url?.trim() || "" : ""
  const groupMembers = [
    { id: "user", name: userName || "我", avatar_url: userAvatarUrl },
    ...members.map((agent) => ({
      id: agent.id,
      name: agent.name,
      avatar_url: agent.avatar_url,
    })),
  ]
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? rowPressed : rowSurface,
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
}

function GroupAvatar({
  members,
}: {
  members: Array<{ id: string; name: string; avatar_url?: string | null }>
}) {
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

function CreateMenuModal({
  visible,
  theme,
  onClose,
  onCreateSingle,
  onCreateGroup,
}: {
  visible: boolean
  theme: AppTheme
  onClose: () => void
  onCreateSingle: () => void
  onCreateGroup: () => void
}) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.menuBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.mode === "dark" ? "#2b2b2b" : "#4c4c4c",
            },
          ]}
        >
          <Pressable
            onPress={onCreateSingle}
            style={({ pressed }) => [
              styles.menuItem,
              {
                backgroundColor: pressed
                  ? theme.mode === "dark"
                    ? "#363636"
                    : "#5a5a5a"
                  : "transparent",
                borderColor:
                  theme.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.16)",
              },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#67b883" }]}>
              <Text style={styles.menuIconText}>A</Text>
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>创建单聊</Text>
              <Text style={styles.menuHint}>新建一个 Agent</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onCreateGroup}
            style={({ pressed }) => [
              styles.menuItem,
              {
                backgroundColor: pressed
                  ? theme.mode === "dark"
                    ? "#363636"
                    : "#5a5a5a"
                  : "transparent",
                borderColor:
                  theme.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.16)",
              },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#4f9ca8" }]}>
              <Text style={styles.menuIconText}>群</Text>
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>创建群聊</Text>
              <Text style={styles.menuHint}>选择已有 Agent</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function AddAgentModal({
  visible,
  theme,
  onClose,
  onSave,
}: {
  visible: boolean
  theme: AppTheme
  onClose: () => void
  onSave: (input: {
    name: string
    personaPrompt: string
    avatarUrl?: string | null
    copyPersonaPrompt?: boolean
  }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [personaPrompt, setPersonaPrompt] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [copyPersonaPrompt, setCopyPersonaPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const canSave = name.trim().length > 0

  async function chooseAvatar() {
    setError(null)
    const result = await pickAvatarImage()
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.avatar) setAvatarUrl(result.avatar)
  }

  function reset() {
    setName("")
    setPersonaPrompt("")
    setAvatarUrl("")
    setCopyPersonaPrompt(false)
    setError(null)
    setSaving(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        personaPrompt: personaPrompt.trim(),
        avatarUrl: avatarUrl || null,
        copyPersonaPrompt,
      })
      reset()
    } catch (error) {
      setSaving(false)
      setError(error instanceof Error ? error.message : "创建单聊失败")
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.surface, borderColor: theme.softBorder },
          ]}
        >
          <View style={[styles.modalHeader, { borderColor: theme.softBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              添加 Agent
            </Text>
            <Pressable onPress={close} style={styles.modalClose}>
              <Text style={[styles.modalCloseText, { color: theme.muted }]}>
                ×
              </Text>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <Pressable
              onPress={chooseAvatar}
              style={({ pressed }) => [
                styles.avatarPicker,
                {
                  backgroundColor: pressed ? theme.elevated : theme.field,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarPickerPreview,
                  {
                    backgroundColor: "#d8c18b",
                    borderColor: theme.border,
                  },
                ]}
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>A</Text>
                )}
              </View>
              <View style={styles.avatarPickerCopy}>
                <Text style={[styles.avatarPickerTitle, { color: theme.text }]}>
                  头像
                </Text>
                <Text style={[styles.avatarPickerHint, { color: theme.muted }]}>
                  点击上传新的头像
                </Text>
              </View>
            </Pressable>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[
                styles.input,
                {
                  backgroundColor: theme.field,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Agent 名称"
              placeholderTextColor={theme.subtle}
            />
            <TextInput
              value={personaPrompt}
              onChangeText={setPersonaPrompt}
              editable={!copyPersonaPrompt}
              style={[
                styles.promptInput,
                {
                  backgroundColor: theme.field,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder={
                copyPersonaPrompt
                  ? "会复制当前 Agent 的人设提示词"
                  : "人设提示词，例如：温柔地陪我整理情绪"
              }
              placeholderTextColor={theme.subtle}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              onPress={() => setCopyPersonaPrompt((value) => !value)}
              style={({ pressed }) => [
                styles.switchRow,
                {
                  backgroundColor: pressed ? theme.elevated : theme.surface,
                  borderColor: theme.softBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.switchTrack,
                  {
                    backgroundColor: copyPersonaPrompt
                      ? theme.primary
                      : theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.switchKnob,
                    copyPersonaPrompt && styles.switchKnobOn,
                  ]}
                />
              </View>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>
                  复制当前 Agent 的人设提示词
                </Text>
                <Text style={[styles.switchHint, { color: theme.muted }]}>
                  关闭时只使用上方填写的内容
                </Text>
              </View>
            </Pressable>
            {error ? (
              <Text style={[styles.formError, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
            <Pressable
              onPress={save}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor:
                    canSave && !saving
                      ? pressed
                        ? theme.primaryPressed
                        : theme.primary
                      : theme.border,
                },
              ]}
            >
              <Text style={[styles.saveText, { color: theme.primaryText }]}>
                {saving ? "创建中" : "保存并开始聊天"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function CreateGroupModal({
  visible,
  agents,
  theme,
  onClose,
  onSave,
}: {
  visible: boolean
  agents: AgentProfile[]
  theme: AppTheme
  onClose: () => void
  onSave: (input: { title: string; agentIds: string[] }) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSave = selectedIds.length >= 1

  function toggleAgent(agentId: string) {
    setSelectedIds((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    )
  }

  function reset() {
    setTitle("")
    setSelectedIds([])
    setSaving(false)
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ title, agentIds: selectedIds })
      reset()
    } catch (error) {
      setSaving(false)
      setError(error instanceof Error ? error.message : "创建群聊失败")
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.surface, borderColor: theme.softBorder },
          ]}
        >
          <View style={[styles.modalHeader, { borderColor: theme.softBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              创建群聊
            </Text>
            <Pressable onPress={close} style={styles.modalClose}>
              <Text style={[styles.modalCloseText, { color: theme.muted }]}>
                ×
              </Text>
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[
                styles.input,
                {
                  backgroundColor: theme.field,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="群聊名称，可留空"
              placeholderTextColor={theme.subtle}
            />
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>
              选择至少一个 Agent，系统会把我一起加入
            </Text>
            <ScrollView style={styles.agentScroll}>
              <View style={styles.agentList}>
                {agents.map((agent) => {
                  const selected = selectedIds.includes(agent.id)
                  return (
                    <Pressable
                      key={agent.id}
                      onPress={() => toggleAgent(agent.id)}
                      style={[
                        styles.agentOption,
                        {
                          backgroundColor: selected
                            ? theme.elevated
                            : theme.surface,
                          borderColor: selected
                            ? theme.primary
                            : theme.softBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: selected
                              ? theme.primary
                              : "transparent",
                            borderColor: selected
                              ? theme.primary
                              : theme.border,
                          },
                        ]}
                      >
                        {selected ? (
                          <Text
                            style={[
                              styles.checkboxText,
                              { color: theme.primaryText },
                            ]}
                          >
                            ✓
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.agentOptionAvatar,
                          { backgroundColor: "#d8c18b" },
                        ]}
                      >
                        {agent.avatar_url ? (
                          <Image
                            source={{ uri: agent.avatar_url }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.avatarText}>
                            {agent.name.slice(0, 1)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.agentOptionText}>
                        <Text style={[styles.agentName, { color: theme.text }]}>
                          {agent.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.agentPrompt, { color: theme.muted }]}
                        >
                          {agent.persona_prompt || "没有设置人设提示词"}
                        </Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>
            {error ? (
              <Text style={[styles.formError, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null}
            <Pressable
              onPress={save}
              disabled={!canSave || saving}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor:
                    canSave && !saving
                      ? pressed
                        ? theme.primaryPressed
                        : theme.primary
                      : theme.border,
                },
              ]}
            >
              <Text style={[styles.saveText, { color: theme.primaryText }]}>
                {saving ? "创建中" : "创建群聊"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function BottomTabs({
  active,
  theme,
}: {
  active: "chats" | "profile"
  theme: AppTheme
}) {
  const tabs = useMemo(
    () => [
      {
        key: "chats" as const,
        label: "聊天",
        icon: "chat" as const,
        href: "/chats",
      },
      {
        key: "profile" as const,
        label: "我",
        icon: "me" as const,
        href: "/profile",
      },
    ],
    [],
  )
  const tabBackground = theme.mode === "dark" ? "#1f1f1f" : "#f7f7f7"
  return (
    <View
      style={[
        styles.tabs,
        { backgroundColor: tabBackground, borderColor: theme.border },
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.replace(tab.href)}
            style={styles.tab}
          >
            <TabIcon
              type={tab.icon}
              color={selected ? theme.primaryPressed : theme.subtle}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: selected ? theme.primaryPressed : theme.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TabIcon({ type, color }: { type: "chat" | "me"; color: string }) {
  if (type === "me") {
    return (
      <View style={styles.meIcon}>
        <View style={[styles.meIconHead, { backgroundColor: color }]} />
        <View style={[styles.meIconBody, { backgroundColor: color }]} />
      </View>
    )
  }

  return (
    <View style={[styles.chatIcon, { borderColor: color }]}>
      <View style={[styles.chatIconDot, { backgroundColor: color }]} />
      <View style={[styles.chatIconTail, { backgroundColor: color }]} />
    </View>
  )
}

function formatConversationTime(value: number) {
  if (value <= 1) return ""
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingLeft: 18,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    minHeight: 72,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 12,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  groupAvatarGrid: {
    width: 48,
    height: 48,
    position: "relative",
  },
  groupAvatarTile: {
    position: "absolute",
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#9ca7a0",
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderBottomWidth: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  rowTime: {
    fontSize: 12,
  },
  rowPreview: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  tabs: {
    height: 58,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chatIcon: {
    width: 22,
    height: 17,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chatIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chatIconTail: {
    width: 7,
    height: 5,
    borderBottomLeftRadius: 5,
    position: "absolute",
    right: 1,
    bottom: -4,
    transform: [{ rotate: "-22deg" }],
  },
  meIcon: {
    width: 22,
    height: 20,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  meIconHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  meIconBody: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.38)",
  },
  menuBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 58,
    paddingRight: 10,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  menuCard: {
    width: 188,
    borderRadius: 4,
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 28,
    height: 28,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuIconText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  menuCopy: {
    flex: 1,
  },
  menuTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  menuHint: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
    marginTop: 2,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  modalClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "300",
  },
  modalBody: {
    padding: 14,
    gap: 12,
  },
  avatarPicker: {
    minHeight: 70,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarPickerPreview: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarPickerCopy: {
    flex: 1,
  },
  avatarPickerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  avatarPickerHint: {
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    height: 46,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  promptInput: {
    minHeight: 94,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  switchKnobOn: {
    transform: [{ translateX: 18 }],
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  switchHint: {
    fontSize: 12,
    marginTop: 4,
  },
  formError: {
    fontSize: 13,
    lineHeight: 18,
  },
  agentScroll: {
    maxHeight: 260,
  },
  agentList: {
    gap: 8,
  },
  agentOption: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  agentOptionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: "900",
  },
  agentOptionText: {
    flex: 1,
    minWidth: 0,
  },
  agentName: {
    fontSize: 15,
    fontWeight: "800",
  },
  agentPrompt: {
    fontSize: 13,
    marginTop: 4,
  },
  saveButton: {
    height: 46,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "800",
  },
})
