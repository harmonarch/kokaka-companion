import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"

export function ChatInput({
  disabled,
  onSend,
}: {
  disabled?: boolean
  onSend: (content: string) => void
}) {
  const [value, setValue] = useState("")
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!disabled}
        multiline
        placeholder="输入想说的话"
        placeholderTextColor="#778078"
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        disabled={disabled || !value.trim()}
        onPress={() => {
          onSend(value)
          setValue("")
        }}
        style={({ pressed }) => [
          styles.button,
          (disabled || !value.trim()) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>发送</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#dfe4df",
    paddingTop: 14,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd6ce",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#17211c",
    fontSize: 16,
    backgroundColor: "#ffffff",
  },
  button: {
    height: 46,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#1f6f5b",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
})
