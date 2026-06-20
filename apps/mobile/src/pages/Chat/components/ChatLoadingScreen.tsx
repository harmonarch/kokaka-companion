import { ActivityIndicator, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function ChatLoadingScreen({ theme }: { theme: AppTheme }) {
  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.loading}>
        <ActivityIndicator color={theme.primary} />
      </View>
    </View>
  )
}
