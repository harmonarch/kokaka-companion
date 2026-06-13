import { useMemoryStore } from "@/stores/memoryStore"
import { useMemoryActions } from "./useMemoryActions"
import { useMemoryDrafts } from "./useMemoryDrafts"
import { useMemorySession } from "./useMemorySession"

export function useMemoryManager() {
  const session = useMemorySession()
  const memories = useMemoryStore((state) => state.memories)
  const loading = useMemoryStore((state) => state.loading)
  const loaded = useMemoryStore((state) => state.loaded)
  const savingId = useMemoryStore((state) => state.savingId)
  const deletingId = useMemoryStore((state) => state.deletingId)
  const contextOpenId = useMemoryStore((state) => state.contextOpenId)
  const contextLoadingId = useMemoryStore((state) => state.contextLoadingId)
  const contexts = useMemoryStore((state) => state.contexts)
  const error = useMemoryStore((state) => state.error)
  const toggleMemoryContext = useMemoryStore(
    (state) => state.toggleMemoryContext,
  )
  const drafts = useMemoryDrafts(memories)
  const actions = useMemoryActions({
    drafts: drafts.drafts,
    resetDraft: drafts.resetDraft,
    removeDraft: drafts.removeDraft,
  })

  return {
    restoringUser: session.restoringUser,
    user: session.user,
    memories,
    loading,
    loaded,
    savingId,
    deletingId,
    contextOpenId,
    contextLoadingId,
    contexts,
    error,
    drafts: drafts.drafts,
    setDraft: drafts.setDraft,
    toggleMemoryContext,
    goBack: actions.goBack,
    save: actions.save,
    remove: actions.remove,
    resetDraft: actions.resetDraft,
  }
}
