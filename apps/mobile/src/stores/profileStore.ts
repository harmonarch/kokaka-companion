import { create } from "zustand"
import type { ChatProfile, ChatProfiles } from "@ai-companion/shared"
import { useAuthStore } from "@/stores/authStore"
import { loadChatProfiles, saveChatProfiles } from "@/utils/storage"

type ProfileState = {
  profiles: ChatProfiles
  ready: boolean
  loading: boolean
  loadedUserId: string | null
  error: string | null
  loadProfiles: () => Promise<void>
  updateProfiles: (profiles: ChatProfiles) => Promise<void>
}

const emptyChatProfiles: ChatProfiles = {
  user: {
    nickname: null,
    avatar_url: null,
  },
  agent: {
    nickname: null,
    avatar_url: null,
  },
}

function normalizeProfile(profile: ChatProfile): ChatProfile {
  const nickname = profile.nickname?.trim() || null
  const avatarUrl = profile.avatar_url?.trim() || null
  return {
    nickname,
    avatar_url: avatarUrl,
  }
}

let pendingLoad:
  | {
      userId: string
      promise: Promise<void>
    }
  | null = null

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: emptyChatProfiles,
  ready: false,
  loading: false,
  loadedUserId: null,
  error: null,
  loadProfiles: async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      set({
        profiles: emptyChatProfiles,
        ready: true,
        loading: false,
        loadedUserId: null,
        error: null,
      })
      return
    }
    const state = get()
    if (state.loadedUserId === user.id && !state.loading) return
    if (pendingLoad?.userId === user.id) return pendingLoad.promise
    const loadPromise = (async () => {
      set({ loading: true, error: null })
      const cachedProfiles = await loadChatProfiles(user.id)
      if (cachedProfiles) {
        set({
          profiles: cachedProfiles,
          ready: true,
          loadedUserId: user.id,
          error: null,
        })
      } else if (get().loadedUserId !== user.id) {
        set({
          profiles: emptyChatProfiles,
          ready: false,
          loadedUserId: null,
          error: null,
        })
      }
      try {
        const profiles = await useAuthStore.getState().client.chatProfiles()
        await saveChatProfiles(user.id, profiles)
        set({
          profiles,
          ready: true,
          loading: false,
          loadedUserId: user.id,
          error: null,
        })
      } catch (error) {
        set({
          ready: true,
          loading: false,
          loadedUserId: cachedProfiles ? user.id : null,
          error: error instanceof Error ? error.message : "聊天资料载入失败",
        })
      } finally {
        if (pendingLoad?.userId === user.id) pendingLoad = null
      }
    })()
    pendingLoad = { userId: user.id, promise: loadPromise }
    return loadPromise
  },
  updateProfiles: async (profiles) => {
    const normalizedProfiles = {
      user: normalizeProfile(profiles.user),
      agent: normalizeProfile(profiles.agent),
    }
    const savedProfiles = await useAuthStore
      .getState()
      .client.updateChatProfiles(normalizedProfiles)
    const user = useAuthStore.getState().user
    if (user) await saveChatProfiles(user.id, savedProfiles)
    set({
      profiles: savedProfiles,
      ready: true,
      loading: false,
      loadedUserId: user?.id ?? null,
      error: null,
    })
  },
}))
