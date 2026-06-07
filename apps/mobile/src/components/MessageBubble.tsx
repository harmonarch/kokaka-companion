import type { ChatMessage } from "@ai-companion/shared"
import { StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

export function MessageBubble({
  message,
  theme,
}: {
  message: ChatMessage
  theme: AppTheme
}) {
  const isUser = message.role === "user"
  return (
    <View style={[styles.row, isUser && styles.rowRight]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.primary }
            : {
                backgroundColor: theme.softSurface,
                borderColor: theme.bubbleBorder,
                borderWidth: 1,
              },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isUser ? theme.primaryText : theme.text },
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
})
