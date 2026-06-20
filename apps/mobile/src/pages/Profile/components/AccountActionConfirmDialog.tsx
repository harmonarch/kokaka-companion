import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useEffect, useState } from "react"
import type { ViewStyle } from "react-native"
import type { AppTheme } from "@/theme"

export type AccountAction = "logout" | "delete"

const dialogCopy: Record<
  AccountAction,
  {
    kicker: string
    title: string
    hint: string
    confirmText: string
    loadingText: string
    danger: boolean
  }
> = {
  logout: {
    kicker: "退出登录",
    title: "确认退出登录？",
    hint: "退出后需要重新登录才能继续使用。",
    confirmText: "确认退出",
    loadingText: "退出中",
    danger: false,
  },
  delete: {
    kicker: "注销账号",
    title: "确认注销账号？",
    hint: "账号数据会被清除，操作完成后会回到登录页。",
    confirmText: "确认注销",
    loadingText: "注销中",
    danger: true,
  },
}

export function AccountActionConfirmDialog({
  action,
  loading,
  onCancel,
  onConfirm,
  theme,
}: {
  action: AccountAction | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
  theme: AppTheme
}) {
  const [visibleAction, setVisibleAction] = useState<AccountAction | null>(
    action,
  )

  useEffect(() => {
    if (action) setVisibleAction(action)
  }, [action])

  const displayAction = action ?? visibleAction
  const copy = displayAction ? dialogCopy[displayAction] : null
  const confirmBackground = copy?.danger ? theme.danger : theme.primary

  return (
    <Modal
      visible={action !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onDismiss={() => setVisibleAction(null)}
    >
      <View style={styles.modalLayer}>
        <Pressable
          style={styles.modalScrim}
          onPress={onCancel}
          disabled={loading}
        />
        <View
          style={[
            styles.dialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.subtle }]}>
            {copy?.kicker ?? ""}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {copy?.title ?? ""}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {copy?.hint ?? ""}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [
                styles.cancelButton,
                { borderColor: theme.border },
                pressed &&
                  !loading && {
                    backgroundColor: theme.elevated,
                  },
                loading && styles.disabled,
                webNoFocusOutline,
              ]}
            >
              <Text style={[styles.cancelText, { color: theme.text }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: confirmBackground },
                pressed &&
                  !loading && {
                    backgroundColor: confirmBackground,
                  },
                loading && styles.disabled,
                webNoFocusOutline,
              ]}
            >
              <Text style={[styles.confirmText]}>
                {loading ? copy?.loadingText : copy?.confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  kicker: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  title: {
    marginTop: 5,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  hint: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  confirmButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: "#e8e8e8",
  },
  disabled: {
    opacity: 0.55,
  },
})

const webNoFocusOutline: (ViewStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null
