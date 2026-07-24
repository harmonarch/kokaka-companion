import { router } from "expo-router"
import { Pressable, Text, View } from "react-native"
import type { AppTheme } from "@/theme"
import { styles } from "../styles"

const tabs = [
  {
    key: "chats",
    label: "聊天",
    icon: "chat",
    href: "/chats",
  },
  {
    key: "profile",
    label: "我",
    icon: "me",
    href: "/profile",
  },
] as const

type TabKey = (typeof tabs)[number]["key"]

export function BottomTabs({
  active,
  theme,
}: {
  active: TabKey
  theme: AppTheme
}) {
  const tabBackground = theme.mode === "dark" ? "#1f1f1f" : "#f7f7f7"

  return (
    <View
      style={[
        styles.tabs,
        { backgroundColor: tabBackground, borderColor: theme.border },
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.key
        const color = selected ? theme.primaryPressed : theme.subtle

        return (
          <Pressable
            key={tab.key}
            onPress={() => router.replace(tab.href)}
            style={styles.tab}
          >
            <TabIcon type={tab.icon} color={color} />
            <Text
              style={[
                styles.tabLabel,
                { color: selected ? theme.primaryPressed : theme.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function TabIcon({ type, color }: { type: "chat" | "me"; color: string }) {
  if (type === "me") {
    return (
      <View style={styles.meIcon}>
        <View style={[styles.meIconHead, { backgroundColor: color }]} />
        <View style={[styles.meIconBody, { backgroundColor: color }]} />
      </View>
    )
  }

  return (
    <View style={[styles.chatIcon, { borderColor: color }]}>
      <View style={[styles.chatIconDot, { backgroundColor: color }]} />
      <View style={[styles.chatIconTail, { backgroundColor: color }]} />
    </View>
  )
}
