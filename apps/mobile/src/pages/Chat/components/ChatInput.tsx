import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native"
import { webNoFocusInputHighlight } from "@/styles/noFocusHighlight"
import type { AppTheme } from "@/theme"
import { useAutoGrowingChatInputHeight } from "./useAutoGrowingChatInputHeight"
import { useChatInputDraft } from "./useChatInputDraft"

export function ChatInput({
  disabled,
  disabledReason,
  onSend,
  theme,
}: {
  disabled?: boolean
  disabledReason?: string
  onSend: (content: string) => Promise<void>
  theme: AppTheme
}) {
  const draft = useChatInputDraft({ disabled, onSend })
  const autoHeight = useAutoGrowingChatInputHeight(draft.value)

  function handleKeyPress(
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    const keyboardEvent =
      event as NativeSyntheticEvent<TextInputKeyPressEventData> & {
        shiftKey?: boolean
        preventDefault?: () => void
        nativeEvent: TextInputKeyPressEventData & {
          shiftKey?: boolean
          preventDefault?: () => void
        }
      }
    const shiftKey =
      keyboardEvent.shiftKey || keyboardEvent.nativeEvent.shiftKey

    if (Platform.OS !== "web" || keyboardEvent.nativeEvent.key !== "Enter") {
      return
    }
    if (shiftKey) return

    keyboardEvent.preventDefault?.()
    keyboardEvent.nativeEvent.preventDefault?.()
    draft.submit()
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
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
        {autoHeight.hasValue ? (
          <Text
            accessible={false}
            onLayout={autoHeight.handleMeasureLayout}
            style={[styles.input, styles.inputMeasure]}
          >
            {autoHeight.measuredValue}
          </Text>
        ) : null}
        <TextInput
          value={draft.value}
          onChangeText={draft.setValue}
          onKeyPress={handleKeyPress}
          onLayout={autoHeight.handleInputLayout}
          editable={!disabled}
          multiline
          placeholder="慢慢说，想到哪里都可以"
          placeholderTextColor={theme.subtle}
          style={[
            styles.input,
            webNoFocusInputHighlight,
            {
              backgroundColor: "transparent",
              color: theme.text,
              height: autoHeight.height,
              maxHeight: autoHeight.maxHeight,
            },
          ]}
          underlineColorAndroid="transparent"
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
    gap: 7,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  row: {
    gap: 8,
    position: "relative",
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
    paddingHorizontal: 0,
    paddingVertical: 3,
    fontSize: 16,
    lineHeight: 22,
  },
  inputMeasure: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
  button: {
    alignSelf: "flex-end",
    height: 34,
    minWidth: 76,
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
