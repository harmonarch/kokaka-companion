import { Redirect } from "expo-router"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useSettings } from "@/pages/Settings/useSettings"
import { useAppTheme } from "@/theme"
import { ProfileSection } from "./components/ProfileSection"

export default function Settings() {
  const theme = useAppTheme()
  const {
    user,
    nickname,
    setNickname,
    userProfile,
    agentProfile,
    confirmDelete,
    error,
    save,
    signOut,
    remove,
    cancelDelete,
    goBack,
  } = useSettings()

  if (!user) return <Redirect href="/login" />

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.page,
        { backgroundColor: theme.background },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.accent }]}>账号</Text>
          <Text style={[styles.title, { color: theme.text }]}>设置</Text>
        </View>
        <Pressable onPress={goBack} style={styles.link}>
          <Text style={[styles.linkText, { color: theme.primary }]}>返回</Text>
        </Pressable>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>账号资料</Text>
      <Text style={[styles.label, { color: theme.muted }]}>账号昵称</Text>
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
      <ProfileSection
        role="user"
        title="聊天里的你"
        theme={theme}
        value={userProfile}
      />
      <ProfileSection
        role="agent"
        title="聊天里的 Kokaka"
        theme={theme}
        value={agentProfile}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}
      <Pressable
        onPress={save}
        style={({ pressed }) => [
          styles.primary,
          {
            backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            transform: [{ translateY: pressed ? 1 : 0 }],
          },
        ]}
      >
        <Text style={[styles.primaryText, { color: theme.primaryText }]}>
          保存设置
        </Text>
      </Pressable>
      <Pressable
        onPress={signOut}
        style={[
          styles.secondary,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.secondaryText, { color: theme.text }]}>
          退出登录
        </Text>
      </Pressable>
      {confirmDelete ? (
        <View
          style={[
            styles.confirmBox,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.confirmKicker, { color: theme.danger }]}>
            谨慎操作
          </Text>
          <Text style={[styles.confirmTitle, { color: theme.text }]}>
            确认注销账号？
          </Text>
          <Text style={[styles.confirmText, { color: theme.muted }]}>
            账号资料和聊天相关数据会被清理，这个操作不能撤回。
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={cancelDelete}
              style={[styles.confirmSecondary, { borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryText, { color: theme.text }]}>
                先保留
              </Text>
            </Pressable>
            <Pressable
              onPress={remove}
              style={[styles.confirmDanger, { backgroundColor: theme.danger }]}
            >
              <Text
                style={[
                  styles.dangerText,
                  {
                    color:
                      theme.mode === "dark" ? theme.background : theme.surface,
                  },
                ]}
              >
                确认注销
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={remove}
          style={[
            styles.danger,
            {
              backgroundColor: theme.dangerSurface,
              borderColor: theme.dangerBorder,
            },
          ]}
        >
          <Text style={[styles.dangerText, { color: theme.danger }]}>
            注销账号
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    padding: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  link: {
    padding: 8,
  },
  linkText: {
    fontWeight: "800",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
  },
  primary: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontWeight: "800",
  },
  secondary: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontWeight: "800",
  },
  danger: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    fontWeight: "800",
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 9,
  },
  confirmKicker: {
    fontSize: 13,
    fontWeight: "800",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  confirmText: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDanger: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 14,
  },
})
