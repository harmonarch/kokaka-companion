import { Redirect } from "expo-router"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useAuthStore } from "@/stores/authStore"

export default function Index() {
  const ready = useAuthStore((state) => state.ready)
  const user = useAuthStore((state) => state.user)

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1f6f5b" />
      </View>
    )
  }

  return <Redirect href={user ? "/chat" : "/login"} />
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
