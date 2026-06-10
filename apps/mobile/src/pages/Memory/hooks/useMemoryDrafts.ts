import { useEffect, useState } from "react"
import type { Memory } from "@ai-companion/shared"

export function useMemoryDrafts(memories: Memory[]) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, string> = {}
      for (const memory of memories) {
        next[memory.id] = current[memory.id] ?? memory.content
      }
      return next
    })
  }, [memories])

  function setDraft(id: string, content: string) {
    setDrafts((current) => ({
      ...current,
      [id]: content,
    }))
  }

  function resetDraft(memory: Memory) {
    setDrafts((current) => ({
      ...current,
      [memory.id]: memory.content,
    }))
  }

  function removeDraft(id: string) {
    setDrafts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  return {
    drafts,
    setDraft,
    resetDraft,
    removeDraft,
  }
}
