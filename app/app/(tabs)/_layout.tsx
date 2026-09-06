import { Tabs, usePathname } from "expo-router"
import { View } from "react-native"
import { GlassTabBar } from "@/components/GlassTabBar"
import { AddAgentModal } from "@/pages/ChatList/components/AddAgentModal"
import { CreateGroupModal } from "@/pages/ChatList/components/CreateGroupModal"
import { CreateMenuModal } from "@/pages/ChatList/components/CreateMenuModal"
import { useCreateChatFlow } from "@/pages/ChatList/useCreateChatFlow"
import { useAppTheme } from "@/theme"

export default function TabsLayout() {
  const theme = useAppTheme()
  const pathname = usePathname()
  const create = useCreateChatFlow()
  const active = pathname === "/profile" ? "profile" : "chats"

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="chats" options={{ title: "聊天" }} />
        <Tabs.Screen name="profile" options={{ title: "我" }} />
      </Tabs>
      <GlassTabBar active={active} onCreate={create.openCreateMenu} />
      <CreateMenuModal
        visible={create.menuVisible}
        theme={theme}
        onClose={create.closeCreateMenu}
        onCreateSingle={create.openAgentCreator}
        onCreateGroup={create.openGroupCreator}
      />
      <AddAgentModal
        visible={create.agentVisible}
        theme={theme}
        onClose={create.closeAgentModal}
        onSave={create.saveAgent}
      />
      <CreateGroupModal
        visible={create.groupVisible}
        agents={create.agents}
        theme={theme}
        onClose={create.closeGroupModal}
        onSave={create.saveGroup}
      />
    </View>
  )
}
