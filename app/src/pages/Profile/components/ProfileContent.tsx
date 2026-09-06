import { Image, Pressable, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"
import type { AccountAction } from "./AccountActionConfirmDialog"

export function ProfileContent({
  avatar,
  busy,
  nickname,
  onEditProfile,
  onRequestAccountAction,
  theme,
}: {
  avatar: string
  busy: AccountAction | null
  nickname: string
  onEditProfile: () => void
  onRequestAccountAction: (action: AccountAction) => void
  theme: AppTheme
}) {
  return (
    <View style={styles.shell}>
      <ProfileHeader theme={theme} />
      <ProfileSummaryCard
        avatar={avatar}
        nickname={nickname}
        onPress={onEditProfile}
        theme={theme}
      />
      <ProfileActions
        busy={busy}
        onRequestAccountAction={onRequestAccountAction}
        theme={theme}
      />
    </View>
  )
}

function ProfileHeader({ theme }: { theme: AppTheme }) {
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <Text style={[styles.headerTitle, { color: theme.text }]}>我</Text>
    </View>
  )
}

function ProfileSummaryCard({
  avatar,
  nickname,
  onPress,
  theme,
}: {
  avatar: string
  nickname: string
  onPress: () => void
  theme: AppTheme
}) {
  return (
    <Pressable
      onPress={onPress}
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
        <Text style={[styles.nickname, { color: theme.text }]}>{nickname}</Text>
        <Text style={[styles.profileHint, { color: theme.muted }]}>
          设置我的头像和昵称
        </Text>
      </View>
      <Text style={[styles.chevron, { color: theme.subtle }]}>›</Text>
    </Pressable>
  )
}

function ProfileActions({
  busy,
  onRequestAccountAction,
  theme,
}: {
  busy: AccountAction | null
  onRequestAccountAction: (action: AccountAction) => void
  theme: AppTheme
}) {
  return (
    <View style={styles.section}>
      <ProfileRow
        title="退出登录"
        detail={busy === "logout" ? "正在退出" : ""}
        disabled={busy !== null}
        onPress={() => onRequestAccountAction("logout")}
        theme={theme}
      />
      <ProfileRow
        title="注销账号"
        detail="会清除当前账号数据"
        danger
        disabled={busy !== null}
        onPress={() => onRequestAccountAction("delete")}
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
