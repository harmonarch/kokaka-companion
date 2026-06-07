import { Redirect, router } from "expo-router"
import { useEffect } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { AgentStatus } from "@/components/AgentStatus"
import { ChatInput } from "@/components/ChatInput"
import { MessageBubble } from "@/components/MessageBubble"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { useAppTheme } from "@/theme"

export default function Chat() {
  const theme = useAppTheme()
  const user = useAuthStore((state) => state.user)
  const messages = useChatStore((state) => state.messages)
  const status = useChatStore((state) => state.status)
  const connection = useChatStore((state) => state.connection)
  const historyLoaded = useChatStore((state) => state.historyLoaded)
  const historyLoading = useChatStore((state) => state.historyLoading)
  const emotionState = useChatStore((state) => state.emotionState)
  const error = useChatStore((state) => state.error)
  const connect = useChatStore((state) => state.connect)
  const loadHistory = useChatStore((state) => state.loadHistory)
  const loadOlderHistory = useChatStore((state) => state.loadOlderHistory)
  const disconnect = useChatStore((state) => state.disconnect)
  const send = useChatStore((state) => state.send)

  useEffect(() => {
    if (user) {
      loadHistory()
      connect()
    }
    return () => disconnect()
  }, [connect, disconnect, loadHistory, user])

  if (!user) return <Redirect href="/login" />

  const inputDisabled = connection !== "connected" || status !== "idle"
  const disabledReason =
    connection !== "connected"
      ? "正在重新连接，马上就能继续说。"
      : status !== "idle"
        ? "Kokaka 正在读你的话，等这一句回来后就能继续。"
        : undefined

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.accent }]}>
            Kokaka 在听
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            今天想说什么
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {user.nickname ?? user.email}
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
      <AgentStatus
        connection={connection}
        emotionState={emotionState}
        theme={theme}
      />
      <FlatList
        inverted
        style={[styles.list, { borderColor: theme.softBorder }]}
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
          <MessageBubble message={item} theme={theme} />
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
            <View
              style={[
                styles.emptyMark,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.emptyMarkText, { color: theme.primary }]}>
                ko
              </Text>
            </View>
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
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
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
  emptyMark: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyMarkText: {
    fontSize: 15,
    fontWeight: "900",
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
