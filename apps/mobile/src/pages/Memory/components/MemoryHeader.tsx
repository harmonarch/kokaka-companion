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
    <View style={[styles.header, { borderColor: theme.border }]}>
      <Pressable onPress={onBack} style={styles.iconButton}>
        <Text style={[styles.iconText, { color: theme.text }]}>‹</Text>
      </Pressable>
      <View style={styles.headerTitle}>
        <Text style={[styles.title, { color: theme.text }]}>管理记忆</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          查看、编辑和删除
        </Text>
      </View>
      <View style={styles.iconButton} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "300",
  },
})
