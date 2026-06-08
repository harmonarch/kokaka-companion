import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { Redirect, router } from "expo-router"
import { useAppTheme } from "@/theme"
import { useChat } from "@/pages/Chat/useChat"
import { ChatInput } from "./components/ChatInput"
import { MessageBubble } from "./components/MessageBubble"

export default function Chat() {
  const theme = useAppTheme()
 
  const {
    user,
    chatTitle,
    messages,
    profiles,
    inputDisabled,
    disabledReason,
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
  } = useChat()
  
  if (!user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.accent }]}>
            {chatTitle}
          </Text>
         
        </View>
        <Pressable
          onPress={() => router.push("/settings")}
          style={[styles.secondary, { borderColor: theme.border }]}
        >
          <Text style={[styles.secondaryText, { color: theme.text }]}>
            设置
          </Text>
        </Pressable>
      </View>
      <View style={styles.chatBody}>
        <FlatList
          inverted
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.emptyListContent,
          ]}
          data={messages}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} profiles={profiles} theme={theme} />
          )}
          ListFooterComponent={
            historyLoading ? (
              <Text style={[styles.historyStatus, { color: theme.muted }]}>
                正在载入更早的聊天
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: theme.elevated,
                  borderColor: theme.softBorder,
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                可以从一句很小的话开始。
              </Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                例如：今天有点累，但我还说不清楚。
              </Text>
            </View>
          }
          onEndReached={historyLoaded ? loadOlderHistory : undefined}
          onEndReachedThreshold={0.2}
        />
        {error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : null}
        <ChatInput
          disabled={inputDisabled}
          disabledReason={disabledReason}
          onSend={send}
          theme={theme}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  secondaryText: {
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 18,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  historyStatus: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 26,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
  },
})
