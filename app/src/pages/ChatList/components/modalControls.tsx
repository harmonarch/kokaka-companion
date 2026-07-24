import { Pressable, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

export function ModalHeader({
  title,
  theme,
  onClose,
}: {
  title: string
  theme: AppTheme
  onClose: () => void
}) {
  return (
    <View style={[styles.modalHeader, { borderColor: theme.softBorder }]}>
      <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
      <Pressable onPress={onClose} style={styles.modalClose}>
        <Text style={[styles.modalCloseText, { color: theme.muted }]}>×</Text>
      </Pressable>
    </View>
  )
}

export function FormError({
  error,
  theme,
}: {
  error: string | null
  theme: AppTheme
}) {
  if (!error) return null

  return (
    <Text style={[styles.formError, { color: theme.danger }]}>{error}</Text>
  )
}

export function SaveButton({
  disabled,
  label,
  theme,
  onPress,
}: {
  disabled: boolean
  label: string
  theme: AppTheme
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.saveButton,
        {
          backgroundColor: !disabled
            ? pressed
              ? theme.primaryPressed
              : theme.primary
            : theme.border,
        },
      ]}
    >
      <Text style={[styles.saveText, { color: theme.primaryText }]}>
        {label}
      </Text>
    </Pressable>
  )
}
