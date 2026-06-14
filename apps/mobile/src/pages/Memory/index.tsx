import { Redirect } from "expo-router"
import { useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"
import { useProfileStore } from "@/stores/profileStore"
import { useAppTheme } from "@/theme"
import { MemoryCard } from "./components/MemoryCard"
import { MemoryContextDialog } from "./components/MemoryContextDialog"
import { MemoryHeader } from "./components/MemoryHeader"
import { useMemoryDialogs } from "./hooks/useMemoryDialogs"
import { useMemoryList } from "./hooks/useMemoryList"
import { useMemoryManager } from "./hooks/useMemoryManager"
import { tabDescriptions, tabLabels, type MemoryTab } from "./types"

export default function Memory() {
  const theme = useAppTheme()
  const profiles = useProfileStore((state) => state.profiles)
  const [activeTab, setActiveTab] = useState<MemoryTab>("preference")
  const [searchText, setSearchText] = useState("")
  const {
    restoringUser,
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

  const { counts, isSearching, listItems } = useMemoryList({
    memories,
    activeTab,
    searchText,
  })
  const {
    contextMemory,
    contextMemoryId,
    contextLoading,
    openContext,
    closeContext,
  } = useMemoryDialogs({
    memories,
    contextOpenId,
    contextLoadingId,
    toggleMemoryContext,
  })
  const contextMessages = contextMemoryId
    ? (contexts[contextMemoryId] ?? [])
    : []
  if (restoringUser) {
    return (
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <MemoryHeader onBack={goBack} theme={theme} />
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.muted }]}>
            正在载入记忆
          </Text>
        </View>
      </View>
    )
  }

  if (!user) return <Redirect href="/login" />

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <MemoryHeader onBack={goBack} theme={theme} />
        <View
          style={[
            styles.searchSection,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.searchBox,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 1024 1024"
              style={styles.searchIcon}
            >
              <Path
                d="M949.355 925.236L783.373 759.254a416.688 416.688 0 0 1-26.602 26.602l165.982 165.982c7.346 7.346 19.255 7.346 26.602 0 7.345-7.346 7.345-19.257 0-26.602zM477.75 104.018c-207.78 0-376.217 168.437-376.217 376.214 0 207.778 168.437 376.215 376.217 376.215 207.776 0 376.213-168.437 376.213-376.215 0-207.777-168.437-376.214-376.213-376.214z m0 714.807c-187.002 0-338.596-151.592-338.596-338.594 0-186.998 151.594-338.594 338.596-338.594 186.998 0 338.594 151.596 338.594 338.594 0 187.002-151.596 338.594-338.594 338.594z"
                fill={theme.subtle}
              />
            </Svg>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              style={[
                styles.searchInput,
                webTextNoFocusOutline,
                { color: theme.text },
              ]}
              placeholder="搜索记忆"
              placeholderTextColor={theme.subtle}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isSearching ? (
              <Pressable
                onPress={() => setSearchText("")}
                style={styles.clearButton}
              >
                <Text style={[styles.clearText, { color: theme.subtle }]}>
                  ×
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.tabs,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {(["preference", "event", "emotion_snapshot"] as const).map((tab) => {
            const selected = activeTab === tab
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, webNoFocusOutline]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: selected ? theme.text : theme.muted },
                    selected && styles.tabTextSelected,
                  ]}
                >
                  {tabLabels[tab]}
                </Text>
                <View
                  style={[
                    styles.tabIndicator,
                    {
                      backgroundColor: selected ? theme.primary : "transparent",
                    },
                  ]}
                />
              </Pressable>
            )
          })}
        </View>
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.content,
            listItems.length === 0 && styles.emptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listIntro}>
              <View style={styles.introRow}>
                <Text style={[styles.description, { color: theme.muted }]}>
                  {tabDescriptions[activeTab]}
                </Text>
                <Text style={[styles.countText, { color: theme.subtle }]}>
                  {counts[activeTab]} 条
                </Text>
              </View>
              {error ? (
                <Text style={[styles.error, { color: theme.danger }]}>
                  {error}
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {loading || !loaded
                  ? "正在载入记忆"
                  : isSearching
                    ? `没有找到${tabLabels[activeTab]}记忆`
                    : `还没有${tabLabels[activeTab]}记忆`}
              </Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                {isSearching
                  ? "可以换个关键词试试。"
                  : "以后从聊天中提取出的重要信息会出现在这里。"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "section") {
              return (
                <Text style={[styles.sectionTitle, { color: theme.muted }]}>
                  {item.title}
                </Text>
              )
            }

            const memory = item.memory
            return (
              <MemoryCard
                memory={memory}
                draft={drafts[memory.id] ?? memory.content}
                saving={savingId === memory.id}
                deleting={deletingId === memory.id}
                firstInSection={item.firstInSection}
                lastInSection={item.lastInSection}
                contextLoading={contextLoadingId === memory.id}
                onChangeDraft={(content) => setDraft(memory.id, content)}
                onSave={() => save(memory)}
                onReset={() => resetDraft(memory)}
                onDelete={() => remove(memory)}
                onToggleContext={() => void openContext(memory)}
                theme={theme}
              />
            )
          }}
        />
        <MemoryContextDialog
          memory={contextMemory}
          messages={contextMessages}
          loading={contextLoading}
          profiles={profiles}
          onClose={closeContext}
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
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchSection: {
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  searchBox: {
    minHeight: 36,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  searchIcon: {
    width: 18,
    height: 18,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 15,
    lineHeight: 21,
    backgroundColor: "transparent",
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "300",
  },
  tabs: {
    height: 58,
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabText: {
    fontSize: 18,
    lineHeight: 25,
  },
  tabTextSelected: {
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 32,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  content: {
    paddingBottom: 28,
  },
  emptyContent: {
    flexGrow: 1,
  },
  listIntro: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  introRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
  },
  description: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 22,
  },
  countText: {
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 2,
  },
  empty: {
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 36,
    marginTop: 42,
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  sectionTitle: {
    height: 34,
    paddingHorizontal: 20,
    paddingTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
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
    paddingHorizontal: 18,
    paddingTop: 10,
  },
})

const webNoFocusOutline: (ViewStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null

const webTextNoFocusOutline: (TextStyle & { outlineStyle?: "none" }) | null =
  Platform.OS === "web"
    ? {
        outlineStyle: "none",
      }
    : null
