import { useMemo, useState } from "react"
import type { Memory as MemoryItem } from "@ai-companion/shared"

export function useMemoryDialogs({
  memories,
  contextOpenId,
  contextLoadingId,
  toggleMemoryContext,
}: {
  memories: MemoryItem[]
  contextOpenId: string | null
  contextLoadingId: string | null
  toggleMemoryContext: (id: string) => Promise<void>
}) {
  const [contextMemoryId, setContextMemoryId] = useState<string | null>(null)
  const contextMemory = useMemo(
    () => memories.find((memory) => memory.id === contextMemoryId) ?? null,
    [contextMemoryId, memories],
  )
  const contextLoading = contextMemoryId
    ? contextLoadingId === contextMemoryId
    : false

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

  return {
    contextMemory,
    contextMemoryId,
    contextLoading,
    openContext,
    closeContext,
  }
}
