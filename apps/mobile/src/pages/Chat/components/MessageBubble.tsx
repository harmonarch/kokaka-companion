import type { ChatMessage, ChatProfiles } from "@ai-companion/shared"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import type { ProfileRole } from "../profile/types"

export function MessageBubble({
  message,
  profiles,
  theme,
  onAvatarPress,
}: {
  message: ChatMessage
  profiles: ChatProfiles
  theme: AppTheme
  onAvatarPress: (role: ProfileRole) => void
}) {
  const isUser = message.role === "user"
  const profile = isUser ? profiles.user : profiles.agent
  const avatar = profile.avatar_url?.trim() ?? ""
  const hasAvatar = Boolean(avatar)
  const fallbackInitial = isUser ? "我" : "K"

  return (
    <View style={[styles.row, isUser && styles.rowRight]}>
      <View style={[styles.messageLine, isUser && styles.messageLineRight]}>
          <Pressable
            onPress={() => onAvatarPress(isUser ? "user" : "agent")}
            style={[
              styles.avatar,
              {
              backgroundColor: isUser ? "#7fa18c" : "#d8c18b",
                borderColor: theme.border,
              },
            ]}
          >
          {hasAvatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{fallbackInitial}</Text>
          )}
          </Pressable>
        <View style={[styles.message, isUser && styles.messageRight]}>
          <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapRight]}>
              <View
                style={[
                  styles.tail,
                  isUser ? styles.tailRight : styles.tailLeft,
                  {
                  borderRightColor: isUser ? "transparent" : theme.surface,
                    borderLeftColor: isUser ? theme.primary : "transparent",
                  },
                ]}
              />
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
                      backgroundColor: theme.surface,
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
    marginBottom: 14,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  messageLine: {
    maxWidth: "91%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
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
    width: 34,
    height: 34,
    borderRadius: 4,
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
    fontSize: 15,
    fontWeight: "800",
  },
  bubble: {
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  time: {
    fontSize: 12,
    marginTop: 4,
  },
  timeRight: {
    textAlign: "right",
  },
})
