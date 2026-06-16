import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import {
  AccountActionConfirmDialog,
  type AccountAction,
} from "./AccountActionConfirmDialog"

export function AccountActionsMenu({
  visible,
  confirmAction,
  loading,
  onClose,
  onOpenMemories,
  onSignOut,
  onRemove,
  onCancelConfirm,
  onConfirmAction,
  theme,
}: {
  visible: boolean
  confirmAction: AccountAction | null
  loading: boolean
  onClose: () => void
  onOpenMemories: () => void
  onSignOut: () => void
  onRemove: () => void
  onCancelConfirm: () => void
  onConfirmAction: () => void
  theme: AppTheme
}) {
  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.layer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={styles.rail}>
            <View
              style={[
                styles.menu,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.softBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.arrow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.softBorder,
                  },
                ]}
              />
              <Pressable
                onPress={onOpenMemories}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { backgroundColor: theme.elevated },
                ]}
              >
                <Text style={[styles.itemIcon, { color: theme.text }]}>◎</Text>
                <Text style={[styles.itemText, { color: theme.text }]}>
                  管理记忆
                </Text>
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <Pressable
                onPress={onSignOut}
                disabled={loading}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && !loading && { backgroundColor: theme.elevated },
                  loading && styles.disabled,
                ]}
              >
                <Text style={[styles.itemIcon, { color: theme.text }]}>↪</Text>
                <Text style={[styles.itemText, { color: theme.text }]}>
                  退出登录
                </Text>
              </Pressable>
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
              <Pressable
                onPress={onRemove}
                disabled={loading}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed &&
                    !loading && { backgroundColor: theme.dangerSurface },
                  loading && styles.disabled,
                ]}
              >
                <Text style={[styles.itemIcon, { color: theme.danger }]}>
                  ⌫
                </Text>
                <Text style={[styles.itemText, { color: theme.danger }]}>
                  注销账号
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AccountActionConfirmDialog
        action={confirmAction}
        loading={loading}
        onCancel={onCancelConfirm}
        onConfirm={onConfirmAction}
        theme={theme}
      />
    </>
  )
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 72,
  },
  rail: {
    width: "100%",
    alignItems: "flex-end",
    paddingRight: 12,
  },
  menu: {
    width: 170,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "visible",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  arrow: {
    position: "absolute",
    top: -7,
    right: 1,
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
  menuItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    gap: 12,
  },
  itemIcon: {
    width: 22,
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
  },
  itemText: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: 1,
  },
  disabled: {
    opacity: 0.55,
  },
})
