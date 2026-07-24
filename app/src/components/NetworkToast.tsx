import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useToastStore } from "@/stores/toastStore"
import { useAppTheme } from "@/theme"

export function NetworkToast() {
  const theme = useAppTheme()
  const message = useToastStore((state) => state.message)
  const hideToast = useToastStore((state) => state.hideToast)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(hideToast, 2600)
    return () => clearTimeout(timer)
  }, [hideToast, message])

  if (!message) return null

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Text
        selectable
        style={[
          styles.toast,
          {
            backgroundColor: theme.dangerSurface,
            borderColor: theme.dangerBorder,
            color: theme.mode === "dark" ? "#ffb4ad" : "#b84a4a",
          },
        ]}
      >
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: "18%",
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  toast: {
    maxWidth: 360,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
})
