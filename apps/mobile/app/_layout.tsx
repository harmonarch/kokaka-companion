import { Stack } from "expo-router"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import { useAppTheme } from "@/theme"

export default function Layout() {
  const theme = useAppTheme()
  const hydrate = useAuthStore((state) => state.hydrate)
  const loadProfiles = useProfileStore((state) => state.loadProfiles)
  useEffect(() => {
    hydrate().then(() => loadProfiles())
  }, [hydrate, loadProfiles])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  )
}
