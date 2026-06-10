import { Redirect } from "expo-router"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useAppTheme } from "@/theme"
import { MemoryCard } from "./components/MemoryCard"
import { MemoryHeader } from "./components/MemoryHeader"
import { useMemoryManager } from "./hooks/useMemoryManager"

export default function Memory() {
  const theme = useAppTheme()
  const {
    user,
    memories,
    loading,
    loaded,
    savingId,
    deletingId,
    contextOpenId,
    contextLoadingId,
    contexts,
    error,
    drafts,
    setDraft,
    toggleMemoryContext,
    goBack,
    save,
    remove,
    resetDraft,
  } = useMemoryManager()

  if (!user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <MemoryHeader onBack={goBack} theme={theme} />
        <FlatList
          data={memories}
          keyExtractor={(memory) => memory.id}
          contentContainerStyle={[
            styles.content,
            memories.length === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
              <Text style={[styles.error, { color: theme.danger }]}>
                {error}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: theme.surface }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {loading || !loaded ? "正在载入记忆" : "还没有长期记忆"}
              </Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                以后从聊天中提取出的重要信息会出现在这里。
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MemoryCard
              memory={item}
              draft={drafts[item.id] ?? item.content}
              saving={savingId === item.id}
              deleting={deletingId === item.id}
              contextOpen={contextOpenId === item.id}
              contextLoading={contextLoadingId === item.id}
              contextMessages={contexts[item.id] ?? []}
              onChangeDraft={(content) => setDraft(item.id, content)}
              onSave={() => save(item)}
              onReset={() => resetDraft(item)}
              onDelete={() => remove(item)}
              onToggleContext={() => toggleMemoryContext(item.id)}
              theme={theme}
            />
          )}
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
  content: {
    padding: 12,
    gap: 10,
  },
  emptyContent: {
    flexGrow: 1,
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
    lineHeight: 20,
    marginBottom: 10,
  },
})
