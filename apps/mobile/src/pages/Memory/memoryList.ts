import type { Memory as MemoryItem } from "@ai-companion/shared"
import type { MemoryListItem, MemoryTab } from "./types"

export function belongsToTab(memory: MemoryItem, tab: MemoryTab) {
  return memory.type === tab
}

export function normalizeSearchText(text: string) {
  return text.trim().toLowerCase()
}

export function matchesSearch(memory: MemoryItem, query: string) {
  if (!query) return true
  return memory.content.toLowerCase().includes(query)
}

function isRecentMemory(memory: MemoryItem) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return memory.created_at >= weekAgo
}

function createMemoryItems(memories: MemoryItem[]): MemoryListItem[] {
  return memories.map((memory, index) => ({
    id: memory.id,
    kind: "memory" as const,
    memory,
    firstInSection: index === 0,
    lastInSection: index === memories.length - 1,
  }))
}

export function createListItems(memories: MemoryItem[]): MemoryListItem[] {
  const recent = memories.filter(isRecentMemory)
  const older = memories.filter((memory) => !isRecentMemory(memory))
  const items: MemoryListItem[] = []

  if (recent.length > 0) {
    items.push({ id: "section-recent", kind: "section", title: "本周" })
    items.push(...createMemoryItems(recent))
  }

  if (older.length > 0) {
    items.push({ id: "section-older", kind: "section", title: "更早" })
    items.push(...createMemoryItems(older))
  }

  return items
}
