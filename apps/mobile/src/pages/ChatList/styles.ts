import { StyleSheet } from "react-native"
import type { AppTheme } from "@/theme"
import type { ChatListPalette } from "./types"

export function getChatListPalette(theme: AppTheme): ChatListPalette {
  return {
    listBackground: theme.mode === "dark" ? "#111111" : "#ededed",
    navigationBar: theme.mode === "dark" ? "#1f1f1f" : "#ededed",
    rowSurface: theme.mode === "dark" ? "#1b1b1b" : "#ffffff",
    rowPressed: theme.mode === "dark" ? "#252525" : "#f5f5f5",
  }
}

export const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingLeft: 18,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    minHeight: 72,
    paddingLeft: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 12,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  groupAvatarGrid: {
    width: 48,
    height: 48,
    position: "relative",
  },
  groupAvatarTile: {
    position: "absolute",
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#9ca7a0",
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderBottomWidth: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  rowTime: {
    fontSize: 12,
  },
  rowPreview: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  tabs: {
    height: 58,
    marginTop: "auto",
    borderTopWidth: 1,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  chatIcon: {
    width: 22,
    height: 17,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chatIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chatIconTail: {
    width: 7,
    height: 5,
    borderBottomLeftRadius: 5,
    position: "absolute",
    right: 1,
    bottom: -4,
    transform: [{ rotate: "-22deg" }],
  },
  meIcon: {
    width: 22,
    height: 20,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  meIconHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  meIconBody: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.38)",
  },
  menuBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 58,
    paddingRight: 10,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  menuCard: {
    width: 188,
    borderRadius: 4,
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 28,
    height: 28,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuIconText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  menuCopy: {
    flex: 1,
  },
  menuTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  menuHint: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
    marginTop: 2,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    minHeight: 54,
    borderBottomWidth: 1,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  modalClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "300",
  },
  modalBody: {
    padding: 14,
    gap: 12,
  },
  avatarPicker: {
    minHeight: 70,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarPickerPreview: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarPickerCopy: {
    flex: 1,
  },
  avatarPickerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  avatarPickerHint: {
    fontSize: 13,
    marginTop: 4,
  },
  input: {
    height: 46,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  promptInput: {
    minHeight: 94,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  switchKnobOn: {
    transform: [{ translateX: 18 }],
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  switchHint: {
    fontSize: 12,
    marginTop: 4,
  },
  formError: {
    fontSize: 13,
    lineHeight: 18,
  },
  agentScroll: {
    maxHeight: 260,
  },
  agentList: {
    gap: 8,
  },
  agentOption: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  agentOptionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: "900",
  },
  agentOptionText: {
    flex: 1,
    minWidth: 0,
  },
  agentName: {
    fontSize: 15,
    fontWeight: "800",
  },
  agentPrompt: {
    fontSize: 13,
    marginTop: 4,
  },
  saveButton: {
    height: 46,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "800",
  },
})
