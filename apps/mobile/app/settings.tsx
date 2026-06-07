import { Redirect, router } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAuthStore } from "@/stores/authStore"

export default function Settings() {
  const user = useAuthStore((state) => state.user)
  const updateNickname = useAuthStore((state) => state.updateNickname)
  const logout = useAuthStore((state) => state.logout)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const [nickname, setNickname] = useState(user?.nickname ?? "")
  const [error, setError] = useState<string | null>(null)

  if (!user) return <Redirect href="/login" />

  async function save() {
    setError(null)
    try {
      await updateNickname(nickname)
      router.replace("/chat")
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    }
  }

  async function signOut() {
    await logout()
    router.replace("/login")
  }

  async function remove() {
    await deleteAccount()
    router.replace("/login")
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>返回</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>昵称</Text>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={save} style={styles.primary}>
        <Text style={styles.primaryText}>保存昵称</Text>
      </Pressable>
      <Pressable onPress={signOut} style={styles.secondary}>
        <Text style={styles.secondaryText}>退出登录</Text>
      </Pressable>
      <Pressable onPress={remove} style={styles.danger}>
        <Text style={styles.dangerText}>注销账号</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 14,
    backgroundColor: "#f7f6f1",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    color: "#17211c",
    fontSize: 30,
    fontWeight: "800",
  },
  link: {
    padding: 8,
  },
  linkText: {
    color: "#1f6f5b",
    fontWeight: "800",
  },
  label: {
    color: "#526057",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd6ce",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "#ffffff",
    fontSize: 16,
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
    fontWeight: "800",
  },
  secondary: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd6ce",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#17211c",
    fontWeight: "800",
  },
  danger: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c44",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    color: "#b13434",
    fontWeight: "800",
  },
  error: {
    color: "#b13434",
  },
})
