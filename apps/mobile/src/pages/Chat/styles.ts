import { StyleSheet } from "react-native"

export const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 60,
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
    marginTop: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "300",
    marginTop: -2,
  },
  list: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  historyStatus: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateSeparator: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 26,
    paddingVertical: 32,
  },
  emptyListInversionFix: {
    transform: [{ scaleY: -1 }],
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
})
