import { StyleSheet, Text, TextInput, View } from "react-native"
import type { AppTheme } from "@/theme"
import type { ProfileRole } from "../types"
import { AvatarActions } from "./AvatarActions"
import { ProfilePreview } from "./ProfilePreview"

export function ProfileSection({
  title,
  theme,
  value,
}: {
  role: ProfileRole
  title: string
  theme: AppTheme
  value: {
    avatar: string
    pickAvatar: () => void
    nickname: string
    setNickname: (nickname: string) => void
  }
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
        avatar={value.avatar}
        nickname={value.nickname}
        theme={theme}
      />
      <AvatarActions
        avatar={value.avatar}
        onPick={value.pickAvatar}
        theme={theme}
      />
      <Text style={[styles.label, { color: theme.muted }]}>昵称</Text>
      <TextInput
        value={value.nickname}
        onChangeText={value.setNickname}
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
