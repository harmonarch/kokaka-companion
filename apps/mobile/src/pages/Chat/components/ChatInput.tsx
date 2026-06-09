import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { AppTheme } from "@/theme"
import { useChatInputDraft } from "./useChatInputDraft"

export function ChatInput({
  disabled,
  disabledReason,
  onSend,
  theme,
}: {
  disabled?: boolean
  disabledReason?: string
  onSend: (content: string) => void
  theme: AppTheme
}) {
  const draft = useChatInputDraft({ disabled, onSend })

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
        },
      ]}
    >
      {disabled && disabledReason ? (
        <View
          style={[
            styles.noteBox,
            { backgroundColor: theme.primarySoft, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.note, { color: theme.text }]}>
            {disabledReason}
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <TextInput
          value={draft.value}
          onChangeText={draft.setValue}
          editable={!disabled}
          multiline
          placeholder="慢慢说，想到哪里都可以"
          placeholderTextColor={theme.subtle}
          style={[
            styles.input,
            {
              backgroundColor: theme.field,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={draft.cannotSend}
          onPress={draft.submit}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
              transform: [{ translateY: pressed ? 1 : 0 }],
            },
            draft.cannotSend && styles.buttonDisabled,
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.primaryText }]}>
            发送
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginHorizontal: -20,
    marginBottom: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 400,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    height: 48,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
})
