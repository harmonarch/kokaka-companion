import {
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
  preference: "偏好",
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
  if (diffDays > 1 && diffDays < 7) return "本周"
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
  const saveTextColor = saveDisabled ? theme.subtle : theme.primary
  const inputBackgroundColor = changed ? theme.elevated : "transparent"
  const rowRadius = {
    borderTopLeftRadius: firstInSection ? 12 : 0,
    borderTopRightRadius: firstInSection ? 12 : 0,
    borderBottomLeftRadius: lastInSection ? 12 : 0,
    borderBottomRightRadius: lastInSection ? 12 : 0,
  }

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.frame,
          rowRadius,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopWidth: firstInSection ? 1 : 0,
            borderBottomWidth: lastInSection ? 1 : 0,
          },
        ]}
      >
        <View
          style={[
            styles.main,
            {
              borderRightColor: theme.softBorder,
              borderBottomColor: lastInSection
                ? "transparent"
                : theme.softBorder,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            editable={!disabled}
            multiline
            style={[
              styles.input,
              webNoFocusOutline,
              {
                backgroundColor: inputBackgroundColor,
                color: theme.text,
              },
            ]}
            placeholder="记忆内容"
            placeholderTextColor={theme.subtle}
          />
          <Pressable
            onPress={onToggleContext}
            disabled={contextLoading}
            style={({ pressed }) => [
              styles.metaLine,
              pressed && { backgroundColor: theme.elevated },
              contextLoading && styles.disabled,
            ]}
          >
            <Text style={[styles.metaIcon, { color: theme.subtle }]}>◇</Text>
            <Text style={[styles.contextAction, { color: theme.link }]}>
              {contextLabel}
            </Text>
            <Text style={[styles.metaDot, { color: theme.subtle }]}>·</Text>
            <Text style={[styles.metaText, { color: theme.subtle }]}>
              {typeLabels[memory.type]}
            </Text>
            <Text style={[styles.metaDot, { color: theme.subtle }]}>·</Text>
            <Text style={[styles.metaText, { color: theme.subtle }]}>
              {formatDate(memory.created_at)}
            </Text>
            <Text style={[styles.chevron, { color: theme.subtle }]}>
              ›
            </Text>
          </Pressable>
          {changed ? (
            <View style={styles.changedLine}>
              <Text style={[styles.changedText, { color: theme.subtle }]}>
                已修改
              </Text>
              <Text style={[styles.metaDot, { color: theme.subtle }]}>·</Text>
              <Pressable
                onPress={onReset}
                disabled={resetDisabled}
                style={[styles.resetAction, resetDisabled && styles.disabled]}
              >
                <Text style={[styles.resetText, { color: theme.link }]}>
                  还原
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.actionRail,
            {
              borderBottomColor: lastInSection
                ? "transparent"
                : theme.softBorder,
            },
          ]}
        >
          <Pressable
            onPress={onSave}
            disabled={saveDisabled}
            style={({ pressed }) => [
              styles.railButton,
              pressed && !saveDisabled && { backgroundColor: theme.elevated },
              saveDisabled && styles.disabled,
            ]}
          >
            <Text style={[styles.saveText, { color: saveTextColor }]}>
              {saving ? "保存中" : "保存"}
            </Text>
          </Pressable>
          <View
            style={[styles.railDivider, { backgroundColor: theme.softBorder }]}
          />
          <Pressable
            onPress={onDelete}
            disabled={disabled}
            style={({ pressed }) => [
              styles.railButton,
              pressed && !disabled && { backgroundColor: theme.dangerSurface },
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
  )
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 14,
  },
  frame: {
    flexDirection: "row",
    overflow: "hidden",
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  input: {
    minHeight: 48,
    padding: 0,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    borderRadius: 6,
    textAlignVertical: "top",
  },
  main: {
    flex: 1,
    minWidth: 0,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    paddingTop: 17,
    paddingRight: 14,
    paddingBottom: 13,
    paddingLeft: 16,
  },
  metaLine: {
    minHeight: 30,
    marginTop: 7,
    marginLeft: -4,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 7,
  },
  metaIcon: {
    width: 18,
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
  },
  contextAction: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaDot: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    marginLeft: "auto",
    fontSize: 32,
    lineHeight: 32,
    fontWeight: "200",
  },
  changedLine: {
    minHeight: 24,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  changedText: {
    fontSize: 13,
    lineHeight: 18,
  },
  resetAction: {
    minHeight: 24,
    justifyContent: "center",
  },
  resetText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRail: {
    width: 88,
    borderBottomWidth: 1,
  },
  railButton: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  deleteText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  railDivider: {
    height: 1,
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
