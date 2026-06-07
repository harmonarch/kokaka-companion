import { useState } from "react"
import { Redirect, router } from "expo-router"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAuthStore } from "@/stores/authStore"
import { useAppTheme } from "@/theme"

export default function Login() {
  const theme = useAppTheme()
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const [mode, setMode] = useState<"login" | "register">("register")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
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
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.panel}>
        <View style={styles.brand}>
          <View
            style={[
              styles.mark,
              {
                backgroundColor: theme.primarySoft,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.markText, { color: theme.primary }]}>ko</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>
              阳光、大海、微风
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              Kokaka Companion
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          把想说的话慢慢放下来，Kokaka 会陪你整理，也会记住长期的你。
        </Text>
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          <Pressable
            onPress={() => setMode("register")}
            style={[
              styles.tab,
              mode === "register" && { backgroundColor: theme.primary },
            ]}
          >
            <Text
              style={
                mode === "register"
                  ? [styles.tabTextActive, { color: theme.primaryText }]
                  : [styles.tabText, { color: theme.muted }]
              }
            >
              注册
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("login")}
            style={[
              styles.tab,
              mode === "login" && { backgroundColor: theme.primary },
            ]}
          >
            <Text
              style={
                mode === "login"
                  ? [styles.tabTextActive, { color: theme.primaryText }]
                  : [styles.tabText, { color: theme.muted }]
              }
            >
              登录
            </Text>
          </Pressable>
        </View>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="邮箱"
          placeholderTextColor={theme.subtle}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="密码"
          placeholderTextColor={theme.subtle}
          secureTextEntry
        />
        {mode === "register" ? (
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="希望 Kokaka 怎么称呼你"
            placeholderTextColor={theme.subtle}
          />
        ) : null}
        {error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : null}
        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            },
          ]}
        >
          <Text style={[styles.primaryText, { color: theme.primaryText }]}>
            {mode === "register" ? "开始陪伴" : "回到聊天"}
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
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    gap: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    fontSize: 18,
    fontWeight: "900",
  },
  copy: {
    flex: 1,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  tabText: {
    fontWeight: "700",
  },
  tabTextActive: {
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
  },
  primary: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "800",
  },
})
