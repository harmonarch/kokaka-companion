import { useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function ChatHeader({
  title,
  statusText,
  theme,
  onBack,
  onManageMemory,
}: {
  title: string
  statusText: string | null
  theme: AppTheme
  onBack: () => void
  onManageMemory: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  function manageMemory() {
    setMenuOpen(false)
    onManageMemory()
  }

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
      <Pressable
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [
          styles.iconButton,
          pressed && { backgroundColor: theme.elevated },
        ]}
      >
        <Text style={[styles.moreText, { color: theme.text }]}>⋯</Text>
      </Pressable>
      <Modal
        transparent
        animationType="fade"
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.headerMenuBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
          />
          <View
            style={[
              styles.headerMenuCard,
              {
                backgroundColor:
                  theme.mode === "dark" ? "#2b2b2b" : "#4c4c4c",
              },
            ]}
          >
            <Pressable
              onPress={manageMemory}
              style={({ pressed }) => [
                styles.headerMenuItem,
                {
                  backgroundColor: pressed
                    ? theme.mode === "dark"
                      ? "#363636"
                      : "#5a5a5a"
                    : "transparent",
                },
              ]}
            >
              <Text style={styles.headerMenuText}>管理记忆</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}
