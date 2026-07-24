import { useMemo, useState } from "react"
import type { Memory as MemoryItem } from "@ai-companion/shared"

export function useMemoryDialogs({
  memories,
  contextOpenId,
  contextLoadingId,
  deletingId,
  toggleMemoryContext,
  remove,
}: {
  memories: MemoryItem[]
  contextOpenId: string | null
  contextLoadingId: string | null
  deletingId: string | null
  toggleMemoryContext: (id: string) => Promise<void>
  remove: (memory: MemoryItem) => Promise<void>
}) {
  const [contextMemoryId, setContextMemoryId] = useState<string | null>(null)
  const [deleteMemoryId, setDeleteMemoryId] = useState<string | null>(null)
  const contextMemory = useMemo(
    () => memories.find((memory) => memory.id === contextMemoryId) ?? null,
    [contextMemoryId, memories],
  )
  const deleteMemory = useMemo(
    () => memories.find((memory) => memory.id === deleteMemoryId) ?? null,
    [deleteMemoryId, memories],
  )
  const contextLoading = contextMemoryId
    ? contextLoadingId === contextMemoryId
    : false
  const deleteLoading = deleteMemoryId ? deletingId === deleteMemoryId : false

  async function openContext(memory: MemoryItem) {
    setContextMemoryId(memory.id)
    if (contextOpenId !== memory.id) {
      await toggleMemoryContext(memory.id)
    }
  }

  function closeContext() {
    setContextMemoryId(null)
    if (contextMemoryId && contextOpenId === contextMemoryId) {
      void toggleMemoryContext(contextMemoryId)
    }
  }

  function requestDelete(memory: MemoryItem) {
    setDeleteMemoryId(memory.id)
  }

  function cancelDelete() {
    if (deleteLoading) return
    setDeleteMemoryId(null)
  }

  async function confirmDelete() {
    if (!deleteMemory) return
    await remove(deleteMemory)
    setDeleteMemoryId(null)
  }

  return {
    contextMemory,
    contextMemoryId,
    contextLoading,
    deleteMemory,
    deleteLoading,
    openContext,
    closeContext,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
