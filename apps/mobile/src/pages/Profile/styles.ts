import { StyleSheet } from "react-native"

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
    minHeight: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  profileCard: {
    minHeight: 90,
    margin: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  profileCopy: {
    flex: 1,
  },
  nickname: {
    fontSize: 19,
    fontWeight: "900",
  },
  profileHint: {
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    marginHorizontal: 12,
    marginTop: 8,
    gap: 8,
  },
  settingRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  settingDetail: {
    fontSize: 13,
    marginTop: 4,
  },
  chevron: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "300",
  },
  disabled: {
    opacity: 0.55,
  },
})
