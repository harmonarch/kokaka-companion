import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { ViewStyle } from "react-native"
import type {
  ChatMessage,
  ChatProfile,
  ChatProfiles,
  Memory,
} from "@ai-companion/shared"
import type { AppTheme } from "@/theme"

const fallbackRoleLabels: Record<ChatMessage["role"], string> = {
  user: "我",
  agent: "你的 Agent",
}

const fallbackRoleAvatars: Record<ChatMessage["role"], string> = {
  user: "我",
  agent: "K",
}

function formatContextDate(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}年${month}月${day}日`
}

function ContextMessage({
  message,
  profile,
  theme,
}: {
  message: ChatMessage
  profile: ChatProfile
  theme: AppTheme
}) {
  const avatar = profile.avatar_url?.trim() ?? ""
  const nickname = profile.nickname?.trim() || fallbackRoleLabels[message.role]
  const fallbackInitial = fallbackRoleAvatars[message.role]

  return (
    <View style={styles.contextMessage}>
      <View
        style={[
          styles.contextAvatar,
          {
            backgroundColor: message.role === "agent" ? "#d8c18b" : "#7fa18c",
            borderColor: theme.border,
          },
        ]}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.contextAvatarImage} />
        ) : (
          <Text style={styles.contextAvatarText}>{fallbackInitial}</Text>
        )}
      </View>
      <View style={styles.contextMessageMain}>
        <View style={styles.contextMetaRow}>
          <Text style={[styles.contextRole, { color: theme.text }]}>
            {nickname}
          </Text>
          <Text style={[styles.contextDate, { color: theme.subtle }]}>
            {formatContextDate(message.created_at)}
          </Text>
        </View>
        <Text style={[styles.contextContent, { color: theme.text }]}>
          {message.content}
        </Text>
      </View>
    </View>
  )
}

export function MemoryContextDialog({
  memory,
  messages,
  loading,
  profiles,
  onClose,
  theme,
}: {
  memory: Memory | null
  messages: ChatMessage[]
  loading: boolean
  profiles: ChatProfiles
  onClose: () => void
  theme: AppTheme
}) {
  return (
    <Modal
      visible={memory !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalLayer}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View
          style={[
            styles.contextDialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.dialogHeader}>
            <View style={styles.dialogTitleBlock}>
              <Text style={[styles.dialogKicker, { color: theme.subtle }]}>
                关联上下文
              </Text>
              <Text style={[styles.dialogTitle, { color: theme.text }]}>
                {memory?.content ?? ""}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.dialogCloseButton, webNoFocusOutline]}
            >
              <Text style={[styles.dialogCloseText, { color: theme.text }]}>
                ×
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={[
              styles.contextBody,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
            contentContainerStyle={styles.contextBodyContent}
          >
            {loading ? (
              <View style={styles.contextLoading}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.contextEmptyText, { color: theme.muted }]}>
                  正在载入上下文
                </Text>
              </View>
            ) : messages.length > 0 ? (
              messages.map((message) => (
                <ContextMessage
                  key={message.id}
                  message={message}
                  profile={profiles[message.role]}
                  theme={theme}
                />
              ))
            ) : (
              <Text style={[styles.contextEmptyText, { color: theme.muted }]}>
                没有关联上下文
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  contextDialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "78%",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  dialogTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  dialogKicker: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  dialogTitle: {
    marginTop: 4,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
  },
  dialogCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCloseText: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "300",
  },
  contextBody: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    maxHeight: 360,
  },
  contextBodyContent: {
    paddingVertical: 14,
    gap: 12,
  },
  contextLoading: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  contextMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  contextAvatar: {
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  contextAvatarImage: {
    width: "100%",
    height: "100%",
  },
  contextAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  contextMessageMain: {
    flex: 1,
    minWidth: 0,
  },
  contextMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  contextRole: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  contextDate: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 17,
  },
  contextContent: {
    marginTop: 3,
    fontSize: 15,
    lineHeight: 22,
  },
  contextEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
})

const webNoFocusOutline: (ViewStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null
