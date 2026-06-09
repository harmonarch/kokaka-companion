import { Image, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

export function ProfilePreview({
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
      {!trimmedAvatar ? (
        <View
          style={[
            styles.previewAvatar,
            { backgroundColor: theme.primarySoft, borderColor: theme.border },
          ]}
        >
          <Text style={styles.previewAvatarText}>我</Text>
        </View>
      ) : null}
      <View style={styles.previewText}>
        <Text style={[styles.previewName, { color: theme.text }]}>
          {trimmedNickname || "更新头像和昵称"}
        </Text>
        <Text style={[styles.previewHint, { color: theme.muted }]}>
          点击上传新的头像
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewText: {
    flex: 1,
  },
  previewAvatar: {
    width: 54,
    height: 54,
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
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  previewName: {
    fontSize: 15,
    fontWeight: "800",
  },
  previewHint: {
    fontSize: 13,
    marginTop: 3,
  },
})
