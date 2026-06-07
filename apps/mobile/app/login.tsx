import { useState } from "react"
import { Redirect, router } from "expo-router"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAuthStore } from "@/stores/authStore"

export default function Login() {
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const [mode, setMode] = useState<"login" | "register">("register")
  const [email, setEmail] = useState("demo@example.com")
  const [password, setPassword] = useState("password123")
  const [nickname, setNickname] = useState("Kokaka")
  const [error, setError] = useState<string | null>(null)

  if (user) return <Redirect href="/chat" />

  async function submit() {
    setError(null)
    try {
      if (mode === "register") {
        await register(email, password, nickname)
      } else {
        await login(email, password)
      }
      router.replace("/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败")
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>Kokaka Companion</Text>
        <Text style={styles.subtitle}>注册或登录后进入聊天。</Text>
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setMode("register")}
            style={[styles.tab, mode === "register" && styles.tabActive]}
          >
            <Text
              style={
                mode === "register" ? styles.tabTextActive : styles.tabText
              }
            >
              注册
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("login")}
            style={[styles.tab, mode === "login" && styles.tabActive]}
          >
            <Text
              style={mode === "login" ? styles.tabTextActive : styles.tabText}
            >
              登录
            </Text>
          </Pressable>
        </View>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="邮箱"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="密码"
          secureTextEntry
        />
        {mode === "register" ? (
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            style={styles.input}
            placeholder="昵称"
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={submit} style={styles.primary}>
          <Text style={styles.primaryText}>
            {mode === "register" ? "创建账号" : "登录"}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f6f1",
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    gap: 14,
  },
  title: {
    fontSize: 34,
    color: "#17211c",
    fontWeight: "800",
  },
  subtitle: {
    color: "#526057",
    fontSize: 16,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#cfd6ce",
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: "#1f6f5b",
  },
  tabText: {
    color: "#526057",
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd6ce",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },
  error: {
    color: "#b13434",
  },
  primary: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1f6f5b",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
})
