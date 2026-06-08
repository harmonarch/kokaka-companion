import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import { Image, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

export function MessageBubble({
  message,
  profiles,
  theme,
}: {
  message: ChatMessage
  profiles: ChatProfiles
  theme: AppTheme
}) {
  const isUser = message.role === "user"
  const profile = isUser ? profiles.user : profiles.agent
  const avatar = profile.avatar_url?.trim() ?? ""
  const hasAvatar = Boolean(avatar)

  return (
    <View style={[styles.row, isUser && styles.rowRight]}>
      <View style={[styles.messageLine, isUser && styles.messageLineRight]}>
        {hasAvatar ? (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isUser ? theme.primarySoft : theme.elevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          </View>
        ) : null}
        <View style={[styles.message, isUser && styles.messageRight]}>
          <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapRight]}>
            {hasAvatar ? (
              <View
                style={[
                  styles.tail,
                  isUser ? styles.tailRight : styles.tailLeft,
                  {
                    borderRightColor: isUser ? "transparent" : theme.elevated,
                    borderLeftColor: isUser ? theme.primary : "transparent",
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.bubble,
                isUser
                  ? {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                      borderWidth: 1,
                    }
                  : {
                      backgroundColor: theme.elevated,
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
          <Text
            style={[
              styles.time,
              { color: theme.subtle },
              isUser && styles.timeRight,
            ]}
          >
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  )
}

function formatMessageTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
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
  messageLine: {
    maxWidth: "82%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  messageLineRight: {
    flexDirection: "row-reverse",
  },
  message: {
    flexShrink: 1,
    alignItems: "flex-start",
  },
  messageRight: {
    alignItems: "flex-end",
  },
  bubbleWrap: {
    position: "relative",
    alignItems: "flex-start",
  },
  bubbleWrapRight: {
    alignItems: "flex-end",
  },
  tail: {
    position: "absolute",
    top: 9,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    zIndex: 1,
  },
  tailLeft: {
    left: -6,
    borderRightWidth: 7,
  },
  tailRight: {
    right: -6,
    borderLeftWidth: 7,
  },
  avatar: {
    width: 40,
    height: 40,
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
  bubble: {
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
  time: {
    fontSize: 12,
    marginTop: 4,
  },
  timeRight: {
    textAlign: "right",
  },
})
