import { View } from "react-native"
import { Redirect, router } from "expo-router"
import { useAppTheme } from "@/theme"
import { useChat } from "@/pages/Chat/hooks/useChat"
import { ChatBody } from "./components/ChatBody"
import { ChatHeader } from "./components/ChatHeader"
import { ChatLoadingScreen } from "./components/ChatLoadingScreen"
import { ChatOverlays } from "./components/ChatOverlays"
import { styles } from "./styles"

export default function Chat() {
  const theme = useAppTheme()
  const chat = useChat()

  if (chat.restoringUser) {
    return <ChatLoadingScreen theme={theme} />
  }

  if (!chat.user) return <Redirect href="/login" />
  if (!chat.hasActiveConversation) return <Redirect href="/chats" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <ChatHeader
          title={chat.chatTitle}
          statusText={chat.agentStatusText}
          theme={theme}
          onBack={() => router.replace("/chats")}
        />
        <ChatBody
          messages={chat.messages}
          profiles={chat.profiles}
          agentAvatarUrl={chat.agentAvatarUrl}
          conversationAgents={chat.conversationAgents}
          showAgentNames={chat.showAgentNames}
          error={chat.error}
          historyLoading={chat.historyLoading}
          historyLoaded={chat.historyLoaded}
          inputDisabled={chat.inputDisabled}
          disabledReason={chat.disabledReason}
          failedMessageIds={chat.failedMessageIds}
          theme={theme}
          onAvatarPress={chat.profileEditor.openProfileEditor}
          onLoadOlderHistory={chat.loadOlderHistory}
          onTyping={chat.sendTyping}
          onSend={chat.send}
          onRetrySend={chat.retrySend}
          onDeleteMessage={chat.deleteMessage}
        />
        <ChatOverlays profileEditor={chat.profileEditor} theme={theme} />
      </View>
    </View>
  )
}
