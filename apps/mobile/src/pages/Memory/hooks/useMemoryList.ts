import { useMemo } from "react"
import type { Memory as MemoryItem } from "@ai-companion/shared"
import {
  belongsToTab,
  createListItems,
  matchesSearch,
  normalizeSearchText,
} from "../memoryList"
import type { MemoryTab } from "../types"

export function useMemoryList({
  memories,
  activeTab,
  searchText,
}: {
  memories: MemoryItem[]
  activeTab: MemoryTab
  searchText: string
}) {
  const searchQuery = useMemo(
    () => normalizeSearchText(searchText),
    [searchText],
  )
  const searchedMemories = useMemo(
    () => memories.filter((memory) => matchesSearch(memory, searchQuery)),
    [memories, searchQuery],
  )
  const counts = useMemo(
    () => ({
      preference: searchedMemories.filter((memory) =>
        belongsToTab(memory, "preference"),
      ).length,
      event: searchedMemories.filter((memory) => belongsToTab(memory, "event"))
        .length,
      emotion_snapshot: searchedMemories.filter((memory) =>
        belongsToTab(memory, "emotion_snapshot"),
      ).length,
    }),
    [searchedMemories],
  )
  const currentMemories = useMemo(
    () => searchedMemories.filter((memory) => belongsToTab(memory, activeTab)),
    [activeTab, searchedMemories],
  )
  const listItems = useMemo(
    () => createListItems(currentMemories),
    [currentMemories],
  )

  return {
    counts,
    currentMemories,
    isSearching: searchQuery.length > 0,
    listItems,
    visibleCount: currentMemories.length,
  }
}
