import { Stack } from "expo-router"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { useAppTheme } from "@/theme"

export default function Layout() {
  const theme = useAppTheme()
  const hydrate = useAuthStore((state) => state.hydrate)
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  )
}
