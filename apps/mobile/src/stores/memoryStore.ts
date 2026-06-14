import type { ChatMessage, Memory } from "@ai-companion/shared"
import { create } from "zustand"
import { useAuthStore } from "@/stores/authStore"

type MemoryState = {
  memories: Memory[]
  loaded: boolean
  loading: boolean
  savingId: string | null
  deletingId: string | null
  contextOpenId: string | null
  contextLoadingId: string | null
  contexts: Record<string, ChatMessage[]>
  error: string | null
  loadMemories: () => Promise<void>
  toggleMemoryContext: (id: string) => Promise<void>
  updateMemory: (id: string, content: string) => Promise<Memory | null>
  deleteMemory: (id: string) => Promise<void>
}

function sortMemories(memories: Memory[]) {
  return [...memories].sort((a, b) => b.created_at - a.created_at)
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  loaded: false,
  loading: false,
  savingId: null,
  deletingId: null,
  contextOpenId: null,
  contextLoadingId: null,
  contexts: {},
  error: null,
  loadMemories: async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      set({
        memories: [],
        loaded: true,
        loading: false,
        contextOpenId: null,
        contexts: {},
        error: null,
      })
      return
    }
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const response = await useAuthStore.getState().client.memories()
      set({
        memories: sortMemories(response.memories),
        loaded: true,
        loading: false,
        contextOpenId: null,
        contexts: {},
        error: null,
      })
    } catch (error) {
      set({
        loaded: true,
        loading: false,
        error: error instanceof Error ? error.message : "记忆载入失败",
      })
    }
  },
  toggleMemoryContext: async (id) => {
    if (get().contextOpenId === id) {
      set({ contextOpenId: null })
      return
    }
    const cached = get().contexts[id]
    set({ contextOpenId: id })
    if (cached) return

    set({ contextLoadingId: id, error: null })
    try {
      const response = await useAuthStore.getState().client.memoryContext(id)
      set({
        contexts: {
          ...get().contexts,
          [id]: response.messages,
        },
        contextLoadingId: null,
        error: null,
      })
    } catch (error) {
      set({
        contextOpenId: null,
        contextLoadingId: null,
        error: error instanceof Error ? error.message : "上下文载入失败",
      })
    }
  },
  updateMemory: async (id, content) => {
    const trimmed = content.trim()
    if (!trimmed) {
      set({ error: "记忆内容不能为空" })
      return null
    }
    set({ savingId: id, error: null })
    try {
      const savedMemory = await useAuthStore
        .getState()
        .client.updateMemory(id, { content: trimmed })
      set({
        memories: sortMemories(
          get().memories.map((memory) =>
            memory.id === id ? savedMemory : memory,
          ),
        ),
        savingId: null,
        error: null,
      })
      return savedMemory
    } catch (error) {
      set({
        savingId: null,
        error: error instanceof Error ? error.message : "记忆保存失败",
      })
      return null
    }
  },
  deleteMemory: async (id) => {
    set({ deletingId: id, error: null })
    try {
      await useAuthStore.getState().client.deleteMemory(id)
      set({
        memories: get().memories.filter((memory) => memory.id !== id),
        deletingId: null,
        contextOpenId: get().contextOpenId === id ? null : get().contextOpenId,
        contexts: Object.fromEntries(
          Object.entries(get().contexts).filter(
            ([memoryId]) => memoryId !== id,
          ),
        ),
        error: null,
      })
    } catch (error) {
      set({
        deletingId: null,
        error: error instanceof Error ? error.message : "记忆删除失败",
      })
    }
  },
}))
