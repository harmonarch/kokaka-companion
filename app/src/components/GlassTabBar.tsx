import { useEffect, useState } from "react"
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native"
import {
  BackdropFilter,
  Blur,
  Canvas,
  Fill,
  rect,
  rrect,
} from "@shopify/react-native-skia"
import { router } from "expo-router"
import { useAppTheme } from "@/theme"

const PILL_RADIUS = 28
const DOCK_GAP = 12

const tabs = [
  { key: "chats", label: "聊天", icon: "chat", href: "/chats" },
  { key: "profile", label: "我", icon: "me", href: "/profile" },
] as const

type TabKey = (typeof tabs)[number]["key"]

export function GlassTabBar({
  active,
  onCreate,
}: {
  active: TabKey
  onCreate: () => void
}) {
  const theme = useAppTheme()
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const [pillSize, setPillSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled)
    })
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    )
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  const onPillLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setPillSize({ width, height })
  }

  const showGlass = !reduceTransparency && pillSize.width > 0

  return (
    <View style={styles.dock}>
      <View style={styles.pill} onLayout={onPillLayout}>
        {showGlass ? (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <BackdropFilter
              filter={<Blur blur={25} />}
              clip={rrect(
                rect(0, 0, pillSize.width, pillSize.height),
                PILL_RADIUS,
                PILL_RADIUS,
              )}
            >
              <Fill color={theme.glassFill} />
            </BackdropFilter>
          </Canvas>
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]}
          />
        )}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.pillBorder,
            { borderColor: theme.glassBorder },
          ]}
        />
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            selected={active === tab.key}
            theme={theme}
            onPress={() => router.navigate(tab.href)}
          />
        ))}
      </View>
      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="新增"
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
        ]}
      >
        <Text style={[styles.addText, { color: theme.primaryText }]}>＋</Text>
      </Pressable>
    </View>
  )
}

function TabButton({
  label,
  icon,
  selected,
  theme,
  onPress,
}: {
  label: string
  icon: "chat" | "me"
  selected: boolean
  theme: ReturnType<typeof useAppTheme>
  onPress: () => void
}) {
  const color = selected ? theme.primary : theme.subtle

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tab,
        selected && { backgroundColor: theme.glassSelected },
        pressed && { opacity: 0.72 },
      ]}
    >
      <TabIcon type={icon} color={color} />
      <Text
        style={[
          styles.tabLabel,
          {
            color: selected ? theme.primary : theme.muted,
            fontWeight: selected ? "700" : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: DOCK_GAP,
  },
  pill: {
    flex: 1,
    height: "100%",
    borderRadius: PILL_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    overflow: "hidden",
  },
  pillBorder: {
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    fontSize: 12,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "400",
  },
  chatIcon: {
    width: 22,
    height: 17,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chatIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chatIconTail: {
    width: 7,
    height: 5,
    borderBottomLeftRadius: 5,
    position: "absolute",
    right: 1,
    bottom: -4,
    transform: [{ rotate: "-22deg" }],
  },
  meIcon: {
    width: 22,
    height: 20,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  meIconHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  meIconBody: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
})
