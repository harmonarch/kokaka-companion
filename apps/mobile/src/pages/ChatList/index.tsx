import { Redirect } from "expo-router"
import { useMemo } from "react"
import { ActivityIndicator, View } from "react-native"
import { useAppTheme } from "@/theme"
import { AddAgentModal } from "./components/AddAgentModal"
import { BottomTabs } from "./components/BottomTabs"
import { ChatListHeader } from "./components/ChatListHeader"
import { ConversationList } from "./components/ConversationList"
import { getChatListPalette, styles } from "./styles"
import { useChatListPage } from "./useChatListPage"

export default function ChatList() {
  const theme = useAppTheme()
  const chatList = useChatListPage()
  const palette = useMemo(() => getChatListPalette(theme), [theme.mode])

  if (chatList.loading) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </View>
    )
  }

  if (!chatList.user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: palette.listBackground }]}>
      <View style={styles.shell}>
        <ChatListHeader
          theme={theme}
          palette={palette}
          onOpenCreateMenu={chatList.openAgentCreator}
        />
        <ConversationList
          conversations={chatList.conversations}
          agents={chatList.agents}
          userAvatarUrl={chatList.userAvatarUrl}
          userName={chatList.userName}
          theme={theme}
          palette={palette}
          onOpenConversation={chatList.openConversation}
        />
        <BottomTabs active="chats" theme={theme} />
      </View>
      <AddAgentModal
        visible={chatList.agentModalVisible}
        theme={theme}
        onClose={chatList.closeAgentModal}
        onSave={chatList.saveAgent}
      />
    </View>
  )
}
