import { Redirect, router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AgentStatus } from "@/components/AgentStatus";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";

export default function Chat() {
  const user = useAuthStore((state) => state.user);
  const messages = useChatStore((state) => state.messages);
  const status = useChatStore((state) => state.status);
  const connection = useChatStore((state) => state.connection);
  const emotionState = useChatStore((state) => state.emotionState);
  const error = useChatStore((state) => state.error);
  const connect = useChatStore((state) => state.connect);
  const disconnect = useChatStore((state) => state.disconnect);
  const send = useChatStore((state) => state.send);

  useEffect(() => {
    if (user) connect();
    return () => disconnect();
  }, [connect, disconnect, user]);

  if (!user) return <Redirect href="/login" />;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>聊天</Text>
          <Text style={styles.subtitle}>{user.nickname ?? user.email}</Text>
        </View>
        <Pressable onPress={() => router.push("/settings")} style={styles.secondary}>
          <Text style={styles.secondaryText}>设置</Text>
        </Pressable>
      </View>
      <AgentStatus connection={connection} emotionState={emotionState} />
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>可以开始说话了。</Text>
            <Text style={styles.emptyText}>试试输入：今天有点累。</Text>
          </View>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ChatInput disabled={connection !== "connected" || status !== "idle"} onSend={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
    padding: 20,
    gap: 14,
    backgroundColor: "#f7f6f1"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    color: "#17211c",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#526057",
    fontSize: 14,
    marginTop: 2
  },
  secondary: {
    borderWidth: 1,
    borderColor: "#cfd6ce",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryText: {
    color: "#17211c",
    fontWeight: "700"
  },
  list: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#dfe4df"
  },
  listContent: {
    paddingVertical: 18
  },
  empty: {
    paddingVertical: 80,
    alignItems: "center"
  },
  emptyTitle: {
    color: "#17211c",
    fontSize: 20,
    fontWeight: "800"
  },
  emptyText: {
    color: "#526057",
    marginTop: 8,
    fontSize: 15
  },
  error: {
    color: "#b13434"
  }
});
