import { useState } from "react"
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { AppTheme } from "@/theme"
import { pickAvatarImage } from "@/pages/Chat/profile/pickAvatarImage"
import { useToastStore } from "@/stores/toastStore"
import { webNoFocusInputHighlight } from "@/styles/noFocusHighlight"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"
import { styles } from "../styles"
import type { CreateAgentInput } from "../types"
import { FormError, ModalHeader, SaveButton } from "./modalControls"

export function AddAgentModal({
  visible,
  theme,
  onClose,
  onSave,
}: {
  visible: boolean
  theme: AppTheme
  onClose: () => void
  onSave: (input: CreateAgentInput) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [personaPrompt, setPersonaPrompt] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [copyPersonaPrompt, setCopyPersonaPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const showToast = useToastStore((state) => state.showToast)
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
      const networkError = getNetworkErrorMessage(error)
      if (networkError) showToast(networkError)
      setError(getReadableErrorMessage(error, "创建单聊失败"))
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.surface, borderColor: theme.softBorder },
          ]}
        >
          <ModalHeader title="添加 Agent" theme={theme} onClose={close} />
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
                webNoFocusInputHighlight,
                {
                  backgroundColor: theme.field,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              underlineColorAndroid="transparent"
              placeholder="Agent 名称"
              placeholderTextColor={theme.subtle}
            />
            <TextInput
              value={personaPrompt}
              onChangeText={setPersonaPrompt}
              editable={!copyPersonaPrompt}
              style={[
                styles.promptInput,
                webNoFocusInputHighlight,
                {
                  backgroundColor: theme.field,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              underlineColorAndroid="transparent"
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
            <FormError error={error} theme={theme} />
            <SaveButton
              disabled={!canSave || saving}
              label={saving ? "创建中" : "保存并开始聊天"}
              theme={theme}
              onPress={save}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
