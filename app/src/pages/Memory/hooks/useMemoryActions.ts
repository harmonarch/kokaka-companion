import { router } from "expo-router"
import type { Memory } from "@ai-companion/shared"
import { useMemoryStore } from "@/stores/memoryStore"

export function useMemoryActions({
  drafts,
  setDraft,
  resetDraft,
  removeDraft,
}: {
  drafts: Record<string, string>
  setDraft: (id: string, content: string) => void
  resetDraft: (memory: Memory) => void
  removeDraft: (id: string) => void
}) {
  const updateMemory = useMemoryStore((state) => state.updateMemory)
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)

  function goBack() {
    router.replace("/chat")
  }

  async function save(memory: Memory) {
    const content = drafts[memory.id] ?? memory.content
    const savedMemory = await updateMemory(memory.id, content)
    if (savedMemory) setDraft(memory.id, savedMemory.content)
  }

  async function remove(memory: Memory) {
    await deleteMemory(memory.id)
    removeDraft(memory.id)
  }

  return {
    goBack,
    save,
    remove,
    resetDraft,
  }
}
