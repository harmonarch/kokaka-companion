import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import type { ViewStyle } from "react-native"
import type { Memory } from "@ai-companion/shared"
import type { AppTheme } from "@/theme"

export function DeleteMemoryDialog({
  memory,
  loading,
  onCancel,
  onConfirm,
  theme,
}: {
  memory: Memory | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
  theme: AppTheme
}) {
  return (
    <Modal
      visible={memory !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalLayer}>
        <Pressable style={styles.modalScrim} onPress={onCancel} />
        <View
          style={[
            styles.deleteDialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.dialogKicker, { color: theme.subtle }]}>
            删除记忆
          </Text>
          <Text style={[styles.deleteTitle, { color: theme.text }]}>
            确认删除这条记忆？
          </Text>
          <Text style={[styles.deletePreview, { color: theme.muted }]}>
            {memory?.content ?? ""}
          </Text>
          <Text style={[styles.deleteHint, { color: theme.subtle }]}>
            只会影响这一条记忆
          </Text>
          <View style={styles.deleteActions}>
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
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [
                styles.confirmDeleteButton,
                { backgroundColor: theme.danger },
                pressed &&
                  !loading && {
                    backgroundColor: theme.danger,
                  },
                loading && styles.disabled,
                webNoFocusOutline,
              ]}
            >
              <Text
                style={[styles.confirmDeleteText, { color: theme.primaryText }]}
              >
                {loading ? "删除中" : "确认删除"}
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
  dialogKicker: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  deleteDialog: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  deleteTitle: {
    marginTop: 5,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  deletePreview: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  deleteHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  deleteActions: {
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
  cancelButtonText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  confirmDeleteButton: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmDeleteText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
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
