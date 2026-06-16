import { Redirect, router } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { useAppTheme, type AppTheme } from "@/theme"
import {
  AccountActionConfirmDialog,
  type AccountAction,
} from "@/pages/Chat/components/AccountActionConfirmDialog"
import { ProfileEditorModal } from "@/pages/Chat/components/ProfileEditorModal"
import { useProfileEditorModal } from "@/pages/Chat/hooks/useProfileEditorModal"
import { BottomTabs } from "@/pages/ChatList/components/BottomTabs"

export default function Profile() {
  const theme = useAppTheme()
  const ready = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const profiles = useProfileStore((state) => state.profiles)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const profileEditor = useProfileEditorModal()
  const [confirmAction, setConfirmAction] = useState<AccountAction | null>(null)
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null)

  useEffect(() => {
    if (user) void loadProfiles()
  }, [loadProfiles, user])

  if (!ready) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  if (!user) return <Redirect href="/login" />

  const userProfile = profiles.user
  const nickname = userProfile.nickname?.trim() || user.nickname || "我"
  const avatar = userProfile.avatar_url?.trim() ?? ""

  async function signOut() {
    if (busy !== null) return
    setBusy("logout")
    try {
      await logout()
      setBusy(null)
      setConfirmAction(null)
      router.replace("/login")
    } catch (error) {
      setBusy(null)
      throw error
    }
  }

  async function removeAccount() {
    if (busy !== null) return
    setBusy("delete")
    try {
      await deleteAccount()
      setBusy(null)
      setConfirmAction(null)
      router.replace("/login")
    } catch (error) {
      setBusy(null)
      throw error
    }
  }

  function confirmSelectedAction() {
    if (confirmAction === "logout") void signOut()
    if (confirmAction === "delete") void removeAccount()
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.shell}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>我</Text>
        </View>
        <Pressable
          onPress={() => profileEditor.openProfileEditor("user")}
          style={({ pressed }) => [
            styles.profileCard,
            {
              backgroundColor: pressed ? theme.elevated : theme.surface,
              borderColor: theme.softBorder,
            },
          ]}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.primarySoft,
                borderColor: theme.border,
              },
            ]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>我</Text>
            )}
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.nickname, { color: theme.text }]}>
              {nickname}
            </Text>
            <Text style={[styles.profileHint, { color: theme.muted }]}>
              设置我的头像和昵称
            </Text>
          </View>
          <Text style={[styles.chevron, { color: theme.subtle }]}>›</Text>
        </Pressable>

        <View style={styles.section}>
          <ProfileRow
            title="退出登录"
            detail={busy === "logout" ? "正在退出" : ""}
            theme={theme}
            disabled={busy !== null}
            onPress={() => setConfirmAction("logout")}
          />
          <ProfileRow
            title="注销账号"
            detail="会清除当前账号数据"
            danger
            theme={theme}
            disabled={busy !== null}
            onPress={() => setConfirmAction("delete")}
          />
        </View>
        <BottomTabs active="profile" theme={theme} />
      </View>
      <ProfileEditorModal
        role={profileEditor.activeRole}
        profile={profileEditor.activeProfile}
        error={profileEditor.error}
        onClose={profileEditor.closeProfileEditor}
        onSave={profileEditor.saveProfile}
        theme={theme}
      />
      <AccountActionConfirmDialog
        action={confirmAction}
        loading={busy !== null}
        onCancel={() => {
          if (busy === null) setConfirmAction(null)
        }}
        onConfirm={confirmSelectedAction}
        theme={theme}
      />
    </View>
  )
}

function ProfileRow({
  title,
  detail,
  danger,
  disabled,
  theme,
  onPress,
}: {
  title: string
  detail: string
  danger?: boolean
  disabled?: boolean
  theme: AppTheme
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.settingRow,
        {
          backgroundColor: pressed ? theme.elevated : theme.surface,
          borderColor: theme.softBorder,
        },
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.settingCopy}>
        <Text
          style={[
            styles.settingTitle,
            { color: danger ? theme.danger : theme.text },
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.settingDetail, { color: theme.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: theme.subtle }]}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  profileCard: {
    minHeight: 90,
    margin: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatar: {
    width: 58,
    height: 58,
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
  nickname: {
    fontSize: 19,
    fontWeight: "900",
  },
  profileHint: {
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    marginHorizontal: 12,
    marginTop: 8,
    gap: 8,
  },
  settingRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  settingDetail: {
    fontSize: 13,
    marginTop: 4,
  },
  chevron: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },
  disabled: {
    opacity: 0.55,
  },
})
