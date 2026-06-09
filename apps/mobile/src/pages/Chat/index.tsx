import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { Redirect } from "expo-router"
import { useAppTheme } from "@/theme"
import { useChat } from "@/pages/Chat/useChat"
import { AccountActionsMenu } from "./components/AccountActionsMenu"
import { ChatInput } from "./components/ChatInput"
import { MessageBubble } from "./components/MessageBubble"
import { ProfileEditorModal } from "./components/ProfileEditorModal"

export default function Chat() {
  const theme = useAppTheme()
 
  const {
    user,
    chatTitle,
    messages,
    profiles,
    inputDisabled,
    disabledReason,
    error,
    historyLoading,
    historyLoaded,
    loadOlderHistory,
    send,
    profileEditor,
    accountActions,
    goBack,
  } = useChat()
  
  if (!user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.shell,
          {
            backgroundColor: theme.background,
          },
        ]}
      >
        <View style={[styles.header, { borderColor: theme.border }]}>
          <Pressable onPress={goBack} style={styles.iconButton}>
            <Text style={[styles.iconText, { color: theme.text }]}>‹</Text>
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={[styles.title, { color: theme.accent }]}>
              {chatTitle}
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Kokaka 在线
            </Text>
          </View>
          <Pressable
            onPress={accountActions.openMenu}
            style={styles.iconButton}
          >
            <Text style={[styles.moreText, { color: theme.text }]}>···</Text>
          </Pressable>
        </View>
        <View style={styles.chatBody}>
          <FlatList
            inverted
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.emptyListContent,
            ]}
            data={messages}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                profiles={profiles}
                theme={theme}
                onAvatarPress={profileEditor.openProfileEditor}
              />
            )}
            ListFooterComponent={
              historyLoading ? (
                <Text
                  style={[
                    styles.historyStatus,
                    {
                      backgroundColor: theme.border,
                      color: theme.surface,
                    },
                  ]}
                >
                  正在载入更早的聊天
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View
                style={[
                  styles.empty,
                  {
                    backgroundColor: theme.surface,
                  },
                ]}
              >
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  可以从一句很小的话开始。
                </Text>
                <Text style={[styles.emptyText, { color: theme.muted }]}>
                  例如：今天有点累，但我还说不清楚。
                </Text>
              </View>
            }
            onEndReached={historyLoaded ? loadOlderHistory : undefined}
            onEndReachedThreshold={0.2}
          />
          {error ? (
            <Text style={[styles.error, { color: theme.danger }]}>
              {error}
            </Text>
          ) : null}
          <ChatInput
            disabled={inputDisabled}
            disabledReason={disabledReason}
            onSend={send}
            theme={theme}
          />
        </View>
        <ProfileEditorModal
          role={profileEditor.activeRole}
          profile={profileEditor.activeProfile}
          error={profileEditor.error}
          onClose={profileEditor.closeProfileEditor}
          onSave={profileEditor.saveProfile}
          theme={theme}
        />
        <AccountActionsMenu
          visible={accountActions.visible}
          confirmDelete={accountActions.confirmDelete}
          onClose={accountActions.closeMenu}
          onSignOut={accountActions.signOut}
          onRemove={accountActions.remove}
          theme={theme}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  shell: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "300",
  },
  moreText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: -7,
  },
  list: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  historyStatus: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 4,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 26,
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
})
