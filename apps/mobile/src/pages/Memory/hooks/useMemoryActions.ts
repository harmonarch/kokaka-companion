import { router } from "expo-router"
import type { Memory } from "@ai-companion/shared"
import { useMemoryStore } from "@/stores/memoryStore"

export function useMemoryActions({
  drafts,
  resetDraft,
  removeDraft,
}: {
  drafts: Record<string, string>
  resetDraft: (memory: Memory) => void
  removeDraft: (id: string) => void
}) {
  const updateMemory = useMemoryStore((state) => state.updateMemory)
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)

  function goBack() {
    router.replace("/chat")
  }

  async function save(memory: Memory) {
    await updateMemory(memory.id, drafts[memory.id] ?? memory.content)
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
