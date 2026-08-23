import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type {
  GestureResponderEvent,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native"
import Svg, { Path } from "react-native-svg"
import { webNoFocusInputHighlight } from "@/styles/noFocusHighlight"
import type { AppTheme } from "@/theme"
import { useAutoGrowingChatInputHeight } from "./useAutoGrowingChatInputHeight"
import { useChatInputDraft } from "./useChatInputDraft"
import { useWebVoiceRecording } from "./useWebVoiceRecording"

// 语音录制暂时下线：后端 whisper 转写返回 502，修复前隐藏录音入口。
// 恢复时把该开关改为 true（或整体删除）。
const voiceRecordingEnabled = false

const recordingButtonSize = 38

function MicrophoneIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function ChatInput({
  disabled,
  disabledReason,
  onTyping,
  onTranscribeRecording,
  onSend,
  theme,
}: {
  disabled?: boolean
  disabledReason?: string
  onTyping?: () => void
  onTranscribeRecording: (audio: Blob, signal?: AbortSignal) => Promise<string>
  onSend: (content: string) => Promise<void>
  theme: AppTheme
}) {
  const draft = useChatInputDraft({ disabled, onTyping, onSend })
  const autoHeight = useAutoGrowingChatInputHeight(draft.value)
  const voice = useWebVoiceRecording({
    onTranscribeRecording,
    onTranscription: draft.appendTranscription,
  })
  const voiceButtonDisabled =
    disabled || !voice.available || voice.status === "transcribing"
  const voiceStatusMessage = voiceRecordingEnabled
    ? voice.message ??
      (Platform.OS === "web" && !voice.available
        ? "此浏览器不支持语音输入"
        : null)
    : null

  function handleRecordingMove(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent
    if (
      locationX < 0 ||
      locationY < 0 ||
      locationX > recordingButtonSize ||
      locationY > recordingButtonSize
    ) {
      voice.markCancelled()
    }
  }

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
        <View style={styles.footer}>
          <View style={styles.voiceStatus}>
            {voiceStatusMessage ? (
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      voice.status === "error" || voice.status === "failed"
                        ? theme.danger
                        : theme.muted,
                  },
                ]}
              >
                {voiceStatusMessage}
                {voice.status === "recording"
                  ? ` ${(voice.elapsedMs / 1000).toFixed(1)} 秒`
                  : ""}
              </Text>
            ) : null}
            {voice.canRetry ? (
              <View style={styles.retryActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={voice.retry}
                  style={({ pressed }) => [
                    styles.textAction,
                    pressed && styles.textActionPressed,
                  ]}
                >
                  <Text style={[styles.textActionLabel, { color: theme.link }]}>
                    重试
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={voice.discard}
                  style={({ pressed }) => [
                    styles.textAction,
                    pressed && styles.textActionPressed,
                  ]}
                >
                  <Text
                    style={[styles.textActionLabel, { color: theme.muted }]}
                  >
                    删除
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            {voiceRecordingEnabled && Platform.OS === "web" ? (
              <View
                accessibilityRole="button"
                accessibilityLabel={
                  voice.status === "recording" || voice.status === "cancelled"
                    ? "松开结束录音"
                    : "按住录音"
                }
                accessibilityHint="移出按钮可以取消录音"
                accessibilityState={{ disabled: voiceButtonDisabled }}
                onStartShouldSetResponder={() =>
                  !voiceButtonDisabled && !voice.isBusy
                }
                onResponderGrant={() => void voice.beginRecording()}
                onResponderMove={handleRecordingMove}
                onResponderRelease={voice.releaseRecording}
                onResponderTerminate={voice.cancelRecording}
                onResponderTerminationRequest={() => false}
                style={[
                  styles.voiceButton,
                  {
                    backgroundColor:
                      voice.status === "cancelled"
                        ? theme.dangerSurface
                        : voice.status === "recording"
                          ? theme.primarySoft
                          : theme.elevated,
                    borderColor:
                      voice.status === "cancelled"
                        ? theme.dangerBorder
                        : theme.border,
                  },
                  voiceButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <MicrophoneIcon
                  color={
                    voice.status === "cancelled" ? theme.danger : theme.text
                  }
                />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={draft.cannotSend}
              onPress={draft.submit}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: pressed
                    ? theme.primaryPressed
                    : theme.primary,
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
  footer: {
    minHeight: recordingButtonSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  voiceStatus: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
  },
  retryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textAction: {
    minHeight: 24,
    justifyContent: "center",
  },
  textActionPressed: {
    opacity: 0.6,
  },
  textActionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceButton: {
    width: recordingButtonSize,
    height: recordingButtonSize,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    height: recordingButtonSize,
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
