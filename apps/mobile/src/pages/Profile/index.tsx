import { Redirect, router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
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
import { ProfileEditorModal } from "@/pages/Chat/components/ProfileEditorModal"
import { useProfileEditorModal } from "@/pages/Chat/hooks/useProfileEditorModal"

export default function Profile() {
  const theme = useAppTheme()
  const ready = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const profiles = useProfileStore((state) => state.profiles)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const profileEditor = useProfileEditorModal()
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    setBusy("logout")
    await logout()
    setBusy(null)
    router.replace("/login")
  }

  async function removeAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy("delete")
    await deleteAccount()
    setBusy(null)
    router.replace("/login")
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
            title="记忆管理"
            detail="查看和调整长期记忆"
            theme={theme}
            onPress={() => router.push("/memory")}
          />
        </View>

        <View style={styles.section}>
          <ProfileRow
            title="退出登录"
            detail={busy === "logout" ? "正在退出" : ""}
            theme={theme}
            onPress={signOut}
          />
          <ProfileRow
            title={confirmDelete ? "确认注销账号" : "注销账号"}
            detail="会清除当前账号数据"
            danger
            theme={theme}
            onPress={removeAccount}
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
    </View>
  )
}

function ProfileRow({
  title,
  detail,
  danger,
  theme,
  onPress,
}: {
  title: string
  detail: string
  danger?: boolean
  theme: AppTheme
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        {
          backgroundColor: pressed ? theme.elevated : theme.surface,
          borderColor: theme.softBorder,
        },
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

function BottomTabs({
  active,
  theme,
}: {
  active: "chats" | "profile"
  theme: AppTheme
}) {
  const tabs = useMemo(
    () => [
      { key: "chats" as const, label: "聊天", icon: "○", href: "/chats" },
      { key: "profile" as const, label: "我", icon: "●", href: "/profile" },
    ],
    [],
  )
  return (
    <View
      style={[
        styles.tabs,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.replace(tab.href)}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabIcon,
                { color: selected ? theme.primaryPressed : theme.subtle },
              ]}
            >
              {tab.icon}
            </Text>
            <Text
              style={[
                styles.tabLabel,
                { color: selected ? theme.primaryPressed : theme.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
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
  tabs: {
    height: 62,
    marginTop: "auto",
    borderTopWidth: 1,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabIcon: {
    fontSize: 18,
    lineHeight: 20,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
})
