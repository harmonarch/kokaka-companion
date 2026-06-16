import { Pressable, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import type { ChatListPalette } from "../types"
import { styles } from "../styles"

export function ChatListHeader({
  theme,
  palette,
  onOpenCreateMenu,
}: {
  theme: AppTheme
  palette: ChatListPalette
  onOpenCreateMenu: () => void
}) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: palette.navigationBar, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.headerTitle, { color: theme.text }]}>聊天</Text>
      <View style={styles.headerActions}>
        <Pressable
          onPress={onOpenCreateMenu}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: pressed
                ? theme.mode === "dark"
                  ? "#2b2b2b"
                  : "#dedede"
                : "transparent",
            },
          ]}
        >
          <Text style={[styles.headerButtonText, { color: theme.text }]}>
            ＋
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
