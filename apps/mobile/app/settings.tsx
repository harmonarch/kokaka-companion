import { Redirect, router } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { useEffect, useState } from "react"
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { type AppTheme, useAppTheme } from "@/theme"

type ProfileRole = "user" | "agent"

const maxAvatarSize = 240000

export default function Settings() {
  const theme = useAppTheme()
  const user = useAuthStore((state) => state.user)
  const updateNickname = useAuthStore((state) => state.updateNickname)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const profiles = useProfileStore((state) => state.profiles)
  const profilesReady = useProfileStore((state) => state.ready)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  const updateProfiles = useProfileStore((state) => state.updateProfiles)
  const [nickname, setNickname] = useState(user?.nickname ?? "")
  const [userDisplayName, setUserDisplayName] = useState(
    profiles.user.nickname ?? "",
  )
  const [userAvatar, setUserAvatar] = useState(profiles.user.avatar_url ?? "")
  const [agentDisplayName, setAgentDisplayName] = useState(
    profiles.agent.nickname ?? "",
  )
  const [agentAvatar, setAgentAvatar] = useState(
    profiles.agent.avatar_url ?? "",
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadProfiles()
  }, [loadProfiles, user])

  useEffect(() => {
    if (!profilesReady) return
    setUserDisplayName(profiles.user.nickname ?? "")
    setUserAvatar(profiles.user.avatar_url ?? "")
    setAgentDisplayName(profiles.agent.nickname ?? "")
    setAgentAvatar(profiles.agent.avatar_url ?? "")
  }, [profiles, profilesReady])

  if (!user) return <Redirect href="/login" />

  async function save() {
    setError(null)
    try {
      await Promise.all([
        updateNickname(nickname),
        updateProfiles({
          user: {
            nickname: userDisplayName || null,
            avatar_url: userAvatar || null,
          },
          agent: {
            nickname: agentDisplayName || null,
            avatar_url: agentAvatar || null,
          },
        }),
      ])
      router.replace("/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    }
  }

  async function pickAvatar(role: ProfileRole) {
    setError(null)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setError("需要允许访问相册后才能选择头像")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
    })

    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset?.base64) {
      setError("头像读取失败")
      return
    }

    const avatar = `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
    if (avatar.length > maxAvatarSize) {
      setError("头像图片太大，请选择更小的图片")
      return
    }

    if (role === "user") {
      setUserAvatar(avatar)
      return
    }
    setAgentAvatar(avatar)
  }

  async function signOut() {
    await logout()
    router.replace("/login")
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteAccount()
    router.replace("/login")
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.page,
        { backgroundColor: theme.background },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.accent }]}>账号</Text>
          <Text style={[styles.title, { color: theme.text }]}>设置</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={[styles.linkText, { color: theme.primary }]}>返回</Text>
        </Pressable>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>账号资料</Text>
      <Text style={[styles.label, { color: theme.muted }]}>账号昵称</Text>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        style={[
          styles.input,
          {
            backgroundColor: theme.field,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
        placeholder="希望 Kokaka 怎么称呼你"
        placeholderTextColor={theme.subtle}
      />
      <View
        style={[
          styles.section,
          { backgroundColor: theme.surface, borderColor: theme.softBorder },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          聊天里的你
        </Text>
        <ProfilePreview
          avatar={userAvatar}
          nickname={userDisplayName}
          theme={theme}
        />
        <AvatarActions
          avatar={userAvatar}
          onPick={() => pickAvatar("user")}
          onRemove={() => setUserAvatar("")}
          theme={theme}
        />
        <Text style={[styles.label, { color: theme.muted }]}>昵称</Text>
        <TextInput
          value={userDisplayName}
          onChangeText={setUserDisplayName}
          style={[
            styles.input,
            {
              backgroundColor: theme.field,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="留空则聊天里不显示昵称"
          placeholderTextColor={theme.subtle}
        />
      </View>
      <View
        style={[
          styles.section,
          { backgroundColor: theme.surface, borderColor: theme.softBorder },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          聊天里的 Kokaka
        </Text>
        <ProfilePreview
          avatar={agentAvatar}
          nickname={agentDisplayName}
          theme={theme}
        />
        <AvatarActions
          avatar={agentAvatar}
          onPick={() => pickAvatar("agent")}
          onRemove={() => setAgentAvatar("")}
          theme={theme}
        />
        <Text style={[styles.label, { color: theme.muted }]}>昵称</Text>
        <TextInput
          value={agentDisplayName}
          onChangeText={setAgentDisplayName}
          style={[
            styles.input,
            {
              backgroundColor: theme.field,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="留空则聊天里不显示昵称"
          placeholderTextColor={theme.subtle}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}
      <Pressable
        onPress={save}
        style={({ pressed }) => [
          styles.primary,
          {
            backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            transform: [{ translateY: pressed ? 1 : 0 }],
          },
        ]}
      >
        <Text style={[styles.primaryText, { color: theme.primaryText }]}>
          保存设置
        </Text>
      </Pressable>
      <Pressable
        onPress={signOut}
        style={[
          styles.secondary,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.secondaryText, { color: theme.text }]}>
          退出登录
        </Text>
      </Pressable>
      {confirmDelete ? (
        <View
          style={[
            styles.confirmBox,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.confirmKicker, { color: theme.danger }]}>
            谨慎操作
          </Text>
          <Text style={[styles.confirmTitle, { color: theme.text }]}>
            确认注销账号？
          </Text>
          <Text style={[styles.confirmText, { color: theme.muted }]}>
            账号资料和聊天相关数据会被清理，这个操作不能撤回。
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => setConfirmDelete(false)}
              style={[styles.confirmSecondary, { borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryText, { color: theme.text }]}>
                先保留
              </Text>
            </Pressable>
            <Pressable
              onPress={remove}
              style={[styles.confirmDanger, { backgroundColor: theme.danger }]}
            >
              <Text
                style={[
                  styles.dangerText,
                  {
                    color:
                      theme.mode === "dark" ? theme.background : theme.surface,
                  },
                ]}
              >
                确认注销
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={remove}
          style={[
            styles.danger,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.dangerText, { color: theme.danger }]}>
            注销账号
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

function ProfilePreview({
  avatar,
  nickname,
  theme,
}: {
  avatar: string
  nickname: string
  theme: AppTheme
}) {
  const trimmedAvatar = avatar.trim()
  const trimmedNickname = nickname.trim()

  return (
    <View style={styles.preview}>
      {trimmedAvatar ? (
        <View
          style={[
            styles.previewAvatar,
            { backgroundColor: theme.primarySoft, borderColor: theme.border },
          ]}
        >
          <Image
            source={{ uri: trimmedAvatar }}
            style={styles.previewAvatarImage}
          />
        </View>
      ) : null}
      <View style={styles.previewText}>
        <Text style={[styles.previewName, { color: theme.text }]}>
          {trimmedNickname || "聊天里不显示昵称"}
        </Text>
        <Text style={[styles.previewHint, { color: theme.muted }]}>
          未填写头像或昵称时，聊天里对应内容会隐藏。
        </Text>
      </View>
    </View>
  )
}

function AvatarActions({
  avatar,
  onPick,
  onRemove,
  theme,
}: {
  avatar: string
  onPick: () => void
  onRemove: () => void
  theme: AppTheme
}) {
  return (
    <View style={styles.avatarActions}>
      <Pressable
        onPress={onPick}
        style={[styles.avatarButton, { borderColor: theme.border }]}
      >
        <Text style={[styles.avatarButtonText, { color: theme.text }]}>
          {avatar ? "更换头像" : "选择头像"}
        </Text>
      </Pressable>
      {avatar ? (
        <Pressable
          onPress={onRemove}
          style={[
            styles.avatarButton,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.avatarButtonText, { color: theme.danger }]}>
            移除头像
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  link: {
    padding: 8,
  },
  linkText: {
    fontWeight: "800",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewText: {
    flex: 1,
  },
  previewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewAvatarImage: {
    width: "100%",
    height: "100%",
  },
  previewAvatarText: {
    fontSize: 20,
    fontWeight: "800",
  },
  avatarActions: {
    flexDirection: "row",
    gap: 10,
  },
  avatarButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonText: {
    fontWeight: "800",
  },
  previewName: {
    fontSize: 15,
    fontWeight: "800",
  },
  previewHint: {
    fontSize: 13,
    marginTop: 3,
  },
  primary: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontWeight: "800",
  },
  secondary: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontWeight: "800",
  },
  danger: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    fontWeight: "800",
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 9,
  },
  confirmKicker: {
    fontSize: 13,
    fontWeight: "800",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDanger: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 14,
  },
})
