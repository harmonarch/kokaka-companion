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
import { webNoFocusInputHighlight } from "@/styles/noFocusHighlight"
import type { AppTheme } from "@/theme"
import type { ProfileRole } from "../profile/types"
import type { EditableChatProfile } from "../profile/useEditableChatProfile"

export function ProfileEditorModal({
  role,
  profile,
  error,
  onClose,
  onSave,
  theme,
}: {
  role: ProfileRole | null
  profile: EditableChatProfile | null
  error: string | null
  onClose: () => void
  onSave: () => void
  theme: AppTheme
}) {
  const visible = Boolean(role && profile)
  const title = "设置头像和昵称"
  const avatar = profile?.avatar.trim() ?? ""
  const nickname = profile?.nickname ?? ""

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.softBorder,
            },
          ]}
        >
          <View style={[styles.cardHeader, { borderColor: theme.softBorder }]}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: theme.muted }]}>×</Text>
            </Pressable>
          </View>
          {profile ? (
            <View style={styles.body}>
              <View style={styles.profileRow}>
                <Pressable
                  onPress={profile.pickAvatar}
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: theme.primarySoft,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {role === "agent" ? "K" : "我"}
                    </Text>
                  )}
                </Pressable>
                <View style={styles.profileCopy}>
                  <Text style={[styles.profileTitle, { color: theme.text }]}>
                    头像
                  </Text>
                  <Text style={[styles.profileHint, { color: theme.muted }]}>
                    点击上传新的头像
                  </Text>
                </View>
              </View>
              <TextInput
                value={nickname}
                onChangeText={profile.setNickname}
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
                placeholder="输入新的昵称"
                placeholderTextColor={theme.subtle}
              />
              {error ? (
                <Text style={[styles.error, { color: theme.danger }]}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                onPress={onSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: pressed
                      ? theme.primaryPressed
                      : theme.primary,
                    transform: [{ translateY: pressed ? 1 : 0 }],
                  },
                ]}
              >
                <Text style={[styles.saveText, { color: theme.primaryText }]}>
                  保存
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 350,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  cardHeader: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "300",
  },
  body: {
    padding: 14,
    gap: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  profileCopy: {
    flex: 1,
  },
  profileTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  profileHint: {
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
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
