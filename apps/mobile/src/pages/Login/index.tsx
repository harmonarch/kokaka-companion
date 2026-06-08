import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAppTheme } from "@/theme"
import { useLogin } from "@/pages/Login/useLogin"

export default function Login() {
  const theme = useAppTheme()
  const [mode, setMode] = useState<"login" | "register">("register")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  
  const { error, submit } = useLogin()

  const press = () => submit(email, password, nickname, mode)

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={styles.panel}>
        <View style={styles.brand}>
          <Text style={[styles.title, { color: theme.text }]}>
            Kokaka Companion
          </Text>
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
              backgroundColor: theme.field,
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
              backgroundColor: theme.field,
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
                backgroundColor: theme.field,
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
          onPress={press}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
              transform: [{ translateY: pressed ? 1 : 0 }],
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
    gap: 14,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  markText: {
    fontSize: 18,
    fontWeight: "900",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 4,
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
