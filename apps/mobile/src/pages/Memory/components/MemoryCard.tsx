import type { ChatMessage, Memory } from "@ai-companion/shared"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { AppTheme } from "@/theme"

const typeLabels: Record<Memory["type"], string> = {
  event: "事件",
  preference: "偏好",
  emotion_snapshot: "情绪",
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}

const roleLabels: Record<ChatMessage["role"], string> = {
  user: "我",
  agent: "小练",
}

export function MemoryCard({
  memory,
  draft,
  saving,
  deleting,
  contextOpen,
  contextLoading,
  contextMessages,
  onChangeDraft,
  onSave,
  onReset,
  onDelete,
  onToggleContext,
  theme,
}: {
  memory: Memory
  draft: string
  saving: boolean
  deleting: boolean
  contextOpen: boolean
  contextLoading: boolean
  contextMessages: ChatMessage[]
  onChangeDraft: (content: string) => void
  onSave: () => void
  onReset: () => void
  onDelete: () => void
  onToggleContext: () => void
  theme: AppTheme
}) {
  const changed = draft.trim() !== memory.content.trim()
  const disabled = saving || deleting

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.softBorder },
      ]}
    >
      <View style={styles.metaRow}>
        <Text style={[styles.type, { color: theme.text }]}>
          {typeLabels[memory.type]}
        </Text>
        <Text style={[styles.date, { color: theme.muted }]}>
          {formatDate(memory.created_at)}
        </Text>
      </View>
      <TextInput
        value={draft}
        onChangeText={onChangeDraft}
        editable={!disabled}
        multiline
        style={[
          styles.input,
          {
            backgroundColor: theme.field,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
        placeholder="记忆内容"
        placeholderTextColor={theme.subtle}
      />
      <View style={styles.actions}>
        <Pressable
          onPress={onToggleContext}
          disabled={contextLoading}
          style={[
            styles.secondary,
            { borderColor: theme.border },
            contextLoading && styles.disabled,
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.text }]}>
            {contextLoading ? "载入中" : contextOpen ? "收起" : "上下文"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          disabled={!changed || disabled}
          style={[
            styles.secondary,
            { borderColor: theme.border },
            (!changed || disabled) && styles.disabled,
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.text }]}>
            还原
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!changed || disabled || !draft.trim()}
          style={[
            styles.primary,
            { backgroundColor: theme.primary },
            (!changed || disabled || !draft.trim()) && styles.disabled,
          ]}
        >
          <Text style={[styles.primaryText, { color: theme.primaryText }]}>
            {saving ? "保存中" : "保存"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={disabled}
          style={[
            styles.danger,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
            disabled && styles.disabled,
          ]}
        >
          <Text style={[styles.dangerText, { color: theme.danger }]}>
            {deleting ? "删除中" : "删除"}
          </Text>
        </Pressable>
      </View>
      {contextOpen ? (
        <View
          style={[
            styles.context,
            { backgroundColor: theme.field, borderColor: theme.border },
          ]}
        >
          {contextMessages.length > 0 ? (
            contextMessages.map((message) => (
              <View key={message.id} style={styles.contextMessage}>
                <Text style={[styles.contextRole, { color: theme.muted }]}>
                  {roleLabels[message.role]}
                </Text>
                <Text style={[styles.contextContent, { color: theme.text }]}>
                  {message.content}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.contextEmpty, { color: theme.muted }]}>
              没有关联上下文
            </Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  type: {
    fontSize: 14,
    fontWeight: "800",
  },
  date: {
    fontSize: 12,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  primary: {
    flex: 1,
    height: 38,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  danger: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontWeight: "800",
  },
  secondaryText: {
    fontWeight: "800",
  },
  dangerText: {
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
  context: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  contextMessage: {
    gap: 3,
  },
  contextRole: {
    fontSize: 12,
    fontWeight: "800",
  },
  contextContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  contextEmpty: {
    fontSize: 14,
    lineHeight: 20,
  },
})
