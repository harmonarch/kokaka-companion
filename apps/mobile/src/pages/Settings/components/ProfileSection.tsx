import type { ChatProfile } from "@ai-companion/shared"
import { StyleSheet, Text, TextInput, View } from "react-native"
import type { AppTheme } from "@/theme"
import { AvatarActions } from "./AvatarActions"
import { ProfilePreview } from "./ProfilePreview"
import { useAvatarActions } from "./useAvatarActions"
import { useProfilePreview } from "./useProfilePreview"

type ProfileRole = "user" | "agent"

export function useProfileSection({
  role,
  onError,
}: {
  role: ProfileRole
  onError: (error: string | null) => void
}) {
  const avatar = useAvatarActions({ role, onError })
  const profile = useProfilePreview({ role })

  return {
    avatar,
    profile,
    createProfile: (): ChatProfile => profile.createProfile(avatar.avatar),
  }
}

export function ProfileSection({
  title,
  theme,
  value,
}: {
  role: ProfileRole
  title: string
  theme: AppTheme
  value: ReturnType<typeof useProfileSection>
}) {
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.surface, borderColor: theme.softBorder },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <ProfilePreview
        avatar={value.avatar.avatar}
        nickname={value.profile.nickname}
        theme={theme}
      />
      <AvatarActions
        avatar={value.avatar.avatar}
        onPick={value.avatar.pickAvatar}
        theme={theme}
      />
      <Text style={[styles.label, { color: theme.muted }]}>昵称</Text>
      <TextInput
        value={value.profile.nickname}
        onChangeText={value.profile.setNickname}
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
  )
}

const styles = StyleSheet.create({
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
})
