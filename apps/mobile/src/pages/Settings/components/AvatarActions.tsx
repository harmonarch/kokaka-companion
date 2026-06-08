import { Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

export function AvatarActions({
  avatar,
  onPick,
  theme,
}: {
  avatar: string
  onPick: () => void
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
    </View>
  )
}

const styles = StyleSheet.create({
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
})
