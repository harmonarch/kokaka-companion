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
        style={[
          styles.avatarButton,
          {
            backgroundColor: theme.primary,
          },
        ]}
      >
        <Text style={[styles.avatarButtonText, { color: theme.primaryText }]}>
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
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonText: {
    fontWeight: "800",
  },
})
