import { Pressable, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function ChatHeader({
  title,
  statusText,
  theme,
  onBack,
}: {
  title: string
  statusText: string | null
  theme: AppTheme
  onBack: () => void
}) {
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <Pressable onPress={onBack} style={styles.iconButton}>
        <Text style={[styles.backText, { color: theme.text }]}>‹</Text>
      </Pressable>
      <View style={styles.headerTitle}>
        <Text style={[styles.title, { color: theme.accent }]}>{title}</Text>
        {statusText ? (
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {statusText}
          </Text>
        ) : null}
      </View>
      <View style={styles.iconButton} />
    </View>
  )
}
