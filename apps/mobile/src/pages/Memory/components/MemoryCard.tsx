import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { TextStyle } from "react-native"
import type { Memory } from "@ai-companion/shared"
import type { AppTheme } from "@/theme"

const typeLabels: Record<Memory["type"], string> = {
  event: "事件",
  preference: "记忆",
  emotion_snapshot: "情绪",
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000),
  )
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  if (diffDays === 0) return `今天 ${hour}:${minute}`
  if (diffDays === 1) return `昨天 ${hour}:${minute}`
  if (diffDays === 2) return `前天 ${hour}:${minute}`
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}-${day} ${hour}:${minute}`
}

export function MemoryCard({
  memory,
  draft,
  saving,
  deleting,
  firstInSection,
  lastInSection,
  contextLoading,
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
  firstInSection: boolean
  lastInSection: boolean
  contextLoading: boolean
  onChangeDraft: (content: string) => void
  onSave: () => void
  onReset: () => void
  onDelete: () => void
  onToggleContext: () => void
  theme: AppTheme
}) {
  const changed = draft.trim() !== memory.content.trim()
  const disabled = saving || deleting
  const contextLabel = contextLoading ? "载入中" : "上下文"
  const saveDisabled = !changed || disabled || !draft.trim()
  const resetDisabled = !changed || disabled
  const saveTextColor = saveDisabled ? theme.subtle : theme.primaryText
  const inputBackgroundColor = changed ? theme.elevated : theme.field

  return (
    <View
      style={[
        styles.row,
        firstInSection && styles.firstRow,
        lastInSection && styles.lastRow,
      ]}
    >
      <View
        style={[
          styles.frame,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.topLine}>
          <View style={styles.typeLine}>
            <Text style={[styles.typeText, { color: theme.text }]}>
              {typeLabels[memory.type]}
            </Text>
            {changed ? (
              <View
                style={[
                  styles.changedPill,
                  { backgroundColor: theme.primarySoft },
                ]}
              >
                <Text
                  style={[styles.changedPillText, { color: theme.primaryText }]}
                >
                  已修改
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.dateText, { color: theme.subtle }]}>
            {formatDate(memory.created_at)}
          </Text>
        </View>
        <View style={styles.main}>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            editable={!disabled}
            multiline
            style={[
              styles.input,
              webNoFocusOutline,
              {
                borderColor: changed ? theme.border : "transparent",
                backgroundColor: inputBackgroundColor,
                color: theme.text,
              },
            ]}
            placeholder="记忆内容"
            placeholderTextColor={theme.subtle}
          />
        </View>
        <View style={styles.actionLine}>
          <Pressable
            onPress={onToggleContext}
            disabled={contextLoading}
            style={({ pressed }) => [
              styles.contextButton,
              { backgroundColor: theme.elevated, borderColor: theme.border },
              pressed && { backgroundColor: theme.elevated },
              contextLoading && styles.disabled,
            ]}
          >
            {contextLoading ? (
              <ActivityIndicator color={theme.muted} size="small" />
            ) : null}
            <Text style={[styles.contextAction, { color: theme.text }]}>
              {contextLabel}
            </Text>
          </Pressable>
          <View style={styles.editActions}>
            <Pressable
              onPress={onReset}
              disabled={resetDisabled}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.border },
                pressed &&
                  !resetDisabled && {
                    backgroundColor: theme.elevated,
                  },
                resetDisabled && styles.disabled,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                还原
              </Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saveDisabled}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: theme.primary },
                pressed &&
                  !saveDisabled && {
                    backgroundColor: theme.primaryPressed,
                  },
                saveDisabled && {
                  backgroundColor: theme.elevated,
                  borderColor: theme.border,
                },
                saveDisabled && styles.disabled,
              ]}
            >
              <Text style={[styles.saveText, { color: saveTextColor }]}>
                {saving ? "保存中" : "保存"}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              disabled={disabled}
              style={({ pressed }) => [
                styles.deleteButton,
                {
                  backgroundColor: theme.dangerSurface,
                  borderColor: theme.dangerBorder,
                },
                pressed &&
                  !disabled && { backgroundColor: theme.dangerSurface },
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.deleteText, { color: theme.danger }]}>
                {deleting ? "删除中" : "删除"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  firstRow: {
    marginTop: 2,
  },
  lastRow: {
    marginBottom: 18,
  },
  frame: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    paddingTop: 14,
  },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
  },
  typeLine: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  changedPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changedPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  dateText: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 18,
  },
  main: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  input: {
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    borderRadius: 8,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  actionLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  contextButton: {
    flexShrink: 1,
    minHeight: 34,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  contextAction: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  editActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    minHeight: 34,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  deleteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 34,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  saveButton: {
    minHeight: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  saveText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.55,
  },
})

const webNoFocusOutline: (TextStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null
