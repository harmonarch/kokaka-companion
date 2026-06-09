import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAppTheme } from "@/theme"
import { useLogin } from "@/pages/Login/useLogin"
import { useLoginForm } from "@/pages/Login/useLoginForm"

export default function Login() {
  const theme = useAppTheme()
  const form = useLoginForm()
  
  const { error, submit } = useLogin()

  const press = () =>
    submit(form.email, form.password, form.nickname, form.mode)

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.shell,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={styles.headerSide} />
          <View style={styles.headerTitle}>
            <Text style={[styles.navTitle, { color: theme.text }]}>
              {form.mode === "register" ? "注册" : "登录"}
            </Text>
            <Text style={[styles.navSubtitle, { color: theme.muted }]}>
              {form.mode === "register" ? "创建新账号" : "欢迎回来"}
            </Text>
          </View>
          <View style={styles.headerSide}>
            <Text style={[styles.helpText, { color: theme.muted }]}>帮助</Text>
          </View>
        </View>
        <View style={styles.panel}>
          <View style={[styles.mark, { backgroundColor: theme.primarySoft }]}>
            <Text style={styles.markText}>微</Text>
          </View>
          <View style={styles.brand}>
          <Text style={[styles.title, { color: theme.text }]}>
              {form.mode === "register" ? "创建账号" : "邮箱登录"}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
            {form.mode === "register"
              ? "填写基础信息，稍后可继续完善个人资料。"
              : "使用邮箱和密码继续进入聊天。"}
        </Text>
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          <Pressable
            onPress={() => form.setMode("register")}
            style={[
              styles.tab,
              form.mode === "register" && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={
                form.mode === "register"
                  ? [styles.tabTextActive, { color: theme.primaryText }]
                  : [styles.tabText, { color: theme.muted }]
              }
            >
              注册
            </Text>
          </Pressable>
          <Pressable
            onPress={() => form.setMode("login")}
            style={[
              styles.tab,
              form.mode === "login" && { backgroundColor: theme.surface },
            ]}
          >
            <Text
              style={
                form.mode === "login"
                  ? [styles.tabTextActive, { color: theme.primaryText }]
                  : [styles.tabText, { color: theme.muted }]
              }
            >
              登录
            </Text>
          </Pressable>
        </View>
        <TextInput
          value={form.email}
          onChangeText={form.setEmail}
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
          value={form.password}
          onChangeText={form.setPassword}
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
        {form.mode === "register" ? (
          <TextInput
            value={form.nickname}
            onChangeText={form.setNickname}
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
            {form.mode === "register" ? "开始陪伴" : "回到聊天"}
          </Text>
        </Pressable>
          <Text style={[styles.terms, { color: theme.muted }]}>
            {form.mode === "register"
              ? "注册即代表同意服务协议、隐私政策与儿童隐私保护规则。"
              : "登录即代表同意服务协议和隐私政策。"}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  header: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerSide: {
    width: 54,
    alignItems: "flex-end",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  panel: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 46,
    gap: 13,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  markText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  navSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  helpText: {
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 2,
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
    borderRadius: 5,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 15,
  },
  error: {
    fontSize: 14,
  },
  primary: {
    height: 48,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "800",
  },
  terms: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
})
