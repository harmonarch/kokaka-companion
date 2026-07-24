import { useState } from "react"
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { AgentProfile } from "@/stores/conversationStore"
import { useToastStore } from "@/stores/toastStore"
import type { AppTheme } from "@/theme"
import { webNoFocusInputHighlight } from "@/styles/noFocusHighlight"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"
import { styles } from "../styles"
import type { CreateGroupInput } from "../types"
import { FormError, ModalHeader, SaveButton } from "./modalControls"

export function CreateGroupModal({
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
  onSave: (input: CreateGroupInput) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showToast = useToastStore((state) => state.showToast)
  const canSave = selectedIds.length >= 2

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
      const networkError = getNetworkErrorMessage(error)
      if (networkError) showToast(networkError)
      setError(getReadableErrorMessage(error, "创建群聊失败"))
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
          <ModalHeader title="创建群聊" theme={theme} onClose={close} />
          <View style={styles.modalBody}>
            <TextInput
              value={title}
              onChangeText={setTitle}
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
              placeholder="群聊名称，可留空"
              placeholderTextColor={theme.subtle}
            />
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>
              选择至少两个 Agent，系统会把我一起加入
            </Text>
            <ScrollView style={styles.agentScroll}>
              <View style={styles.agentList}>
                {agents.map((agent) => (
                  <AgentOption
                    key={agent.id}
                    agent={agent}
                    selected={selectedIds.includes(agent.id)}
                    theme={theme}
                    onPress={() => toggleAgent(agent.id)}
                  />
                ))}
              </View>
            </ScrollView>
            <FormError error={error} theme={theme} />
            <SaveButton
              disabled={!canSave || saving}
              label={saving ? "创建中" : "创建群聊"}
              theme={theme}
              onPress={save}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

function AgentOption({
  agent,
  selected,
  theme,
  onPress,
}: {
  agent: AgentProfile
  selected: boolean
  theme: AppTheme
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.agentOption,
        {
          backgroundColor: selected ? theme.elevated : theme.surface,
          borderColor: selected ? theme.primary : theme.softBorder,
        },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? theme.primary : "transparent",
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
      >
        {selected ? (
          <Text style={[styles.checkboxText, { color: theme.primaryText }]}>
            ✓
          </Text>
        ) : null}
      </View>
      <View style={[styles.agentOptionAvatar, { backgroundColor: "#d8c18b" }]}>
        {agent.avatar_url ? (
          <Image
            source={{ uri: agent.avatar_url }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{agent.name.slice(0, 1)}</Text>
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
}
