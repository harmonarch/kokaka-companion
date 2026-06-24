import { Stack } from "expo-router"
import { useEffect } from "react"
import { View } from "react-native"
import { NetworkToast } from "@/components/NetworkToast"
import { useAuthStore } from "@/stores/authStore"
import { useAppTheme } from "@/theme"

export default function Layout() {
  const theme = useAppTheme()
  const hydrate = useAuthStore((state) => state.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (typeof document === "undefined") return

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    document.addEventListener("contextmenu", preventContextMenu)
    return () => document.removeEventListener("contextmenu", preventContextMenu)
  }, [])

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      <NetworkToast />
    </View>
  )
}
