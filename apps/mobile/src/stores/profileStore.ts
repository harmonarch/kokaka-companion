import { create } from "zustand"
import type { ChatProfile, ChatProfiles } from "@ai-companion/shared"
import { useAuthStore } from "@/stores/authStore"

type ProfileState = {
  profiles: ChatProfiles
  ready: boolean
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

let pendingLoadProfiles: Promise<void> | null = null
let pendingLoadProfilesUserId: string | null = null

function normalizeProfile(profile: ChatProfile): ChatProfile {
  const nickname = profile.nickname?.trim() || null
  const avatarUrl = profile.avatar_url?.trim() || null
  return {
    nickname,
    avatar_url: avatarUrl,
  }
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: emptyChatProfiles,
  ready: false,
  error: null,
  loadProfiles: async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      pendingLoadProfiles = null
      pendingLoadProfilesUserId = null
      set({ profiles: emptyChatProfiles, ready: true, error: null })
      return
    }

    const userId = user.id
    if (pendingLoadProfiles && pendingLoadProfilesUserId === userId) {
      return pendingLoadProfiles
    }

    const request = useAuthStore
      .getState()
      .client.chatProfiles()
      .then((profiles) => {
        if (useAuthStore.getState().user?.id !== userId) return
        set({ profiles, ready: true, error: null })
      })
      .catch((error) => {
        if (useAuthStore.getState().user?.id !== userId) return
        set({
          ready: true,
          error: error instanceof Error ? error.message : "聊天资料载入失败",
        })
      })
      .finally(() => {
        if (pendingLoadProfiles !== request) return
        pendingLoadProfiles = null
        pendingLoadProfilesUserId = null
      })

    pendingLoadProfiles = request
    pendingLoadProfilesUserId = userId
    return request
  },
  updateProfiles: async (profiles) => {
    const normalizedProfiles = {
      user: normalizeProfile(profiles.user),
      agent: normalizeProfile(profiles.agent),
    }
    const savedProfiles = await useAuthStore
      .getState()
      .client.updateChatProfiles(normalizedProfiles)
    set({ profiles: savedProfiles, ready: true, error: null })
  },
}))
