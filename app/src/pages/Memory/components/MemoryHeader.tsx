import { Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

export function MemoryHeader({
  onBack,
  theme,
}: {
  onBack: () => void
  theme: AppTheme
}) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Pressable onPress={onBack} style={styles.iconButton}>
        <Text style={[styles.iconText, { color: theme.text }]}>‹</Text>
      </Pressable>
      <View style={styles.headerTitle}>
        <Text style={[styles.title, { color: theme.text }]}>管理记忆</Text>
      </View>
      <View style={styles.iconButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
  },
  iconButton: {
    width: 52,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "300",
  },
})
