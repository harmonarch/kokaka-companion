import { Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import type { ChatListPalette } from "../types"
import { styles } from "../styles"

export function ChatListHeader({
  theme,
  palette,
}: {
  theme: AppTheme
  palette: ChatListPalette
}) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: palette.navigationBar, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.headerTitle, { color: theme.text }]}>聊天</Text>
    </View>
  )
}
