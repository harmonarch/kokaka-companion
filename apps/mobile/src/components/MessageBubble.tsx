import type { ChatMessage } from "@ai-companion/shared";
import { StyleSheet, Text, View } from "react-native";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.row, isUser && styles.rowRight]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 12
  },
  rowRight: {
    alignItems: "flex-end"
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  userBubble: {
    backgroundColor: "#1f6f5b"
  },
  agentBubble: {
    backgroundColor: "#eef1ed",
    borderWidth: 1,
    borderColor: "#d9ded8"
  },
  text: {
    color: "#17211c",
    fontSize: 16,
    lineHeight: 23
  },
  userText: {
    color: "#ffffff"
  }
});
