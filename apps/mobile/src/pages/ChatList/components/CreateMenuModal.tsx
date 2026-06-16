import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function CreateMenuModal({
  visible,
  theme,
  onClose,
  onCreateSingle,
  onCreateGroup,
}: {
  visible: boolean
  theme: AppTheme
  onClose: () => void
  onCreateSingle: () => void
  onCreateGroup: () => void
}) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.menuBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.mode === "dark" ? "#2b2b2b" : "#4c4c4c",
            },
          ]}
        >
          <CreateMenuItem
            icon="A"
            iconBackground="#67b883"
            title="创建单聊"
            hint="新建一个 Agent"
            theme={theme}
            onPress={onCreateSingle}
          />
          <CreateMenuItem
            icon="群"
            iconBackground="#4f9ca8"
            title="创建群聊"
            hint="选择已有 Agent"
            theme={theme}
            onPress={onCreateGroup}
          />
        </View>
      </View>
    </Modal>
  )
}

function CreateMenuItem({
  icon,
  iconBackground,
  title,
  hint,
  theme,
  onPress,
}: {
  icon: string
  iconBackground: string
  title: string
  hint: string
  theme: AppTheme
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed
            ? theme.mode === "dark"
              ? "#363636"
              : "#5a5a5a"
            : "transparent",
          borderColor:
            theme.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.16)",
        },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBackground }]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuHint}>{hint}</Text>
      </View>
    </Pressable>
  )
}
