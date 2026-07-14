import { Stack, useNavigationContainerRef } from "expo-router"
import { useEffect } from "react"
import { View } from "react-native"
import { NetworkToast } from "@/components/NetworkToast"
import { useAuthStore } from "@/stores/authStore"
import { useAppTheme } from "@/theme"
import {
  navigationIntegration,
  monitoringEnabled,
  Sentry,
  setMonitoringUser,
} from "@/monitoring/sentry"

function Layout() {
  const theme = useAppTheme()
  const navigationRef = useNavigationContainerRef()
  const hydrate = useAuthStore((state) => state.hydrate)
  const userId = useAuthStore((state) => state.user?.id ?? null)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!monitoringEnabled) return
    navigationIntegration.registerNavigationContainer(navigationRef)
  }, [navigationRef])

  useEffect(() => {
    setMonitoringUser(userId)
  }, [userId])

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

export default monitoringEnabled ? Sentry.wrap(Layout) : Layout
