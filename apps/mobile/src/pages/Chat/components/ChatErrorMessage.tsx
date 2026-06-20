import { Text } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function ChatErrorMessage({
  error,
  theme,
}: {
  error: string | null
  theme: AppTheme
}) {
  if (!error) return null

  return <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
}
