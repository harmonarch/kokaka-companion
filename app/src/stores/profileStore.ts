import { create } from "zustand"
import type { ChatProfile, ChatProfiles } from "@ai-companion/shared"
import { useAuthStore } from "@/stores/authStore"
import { useToastStore } from "@/stores/toastStore"
import { getNetworkErrorMessage, getReadableErrorMessage } from "@/utils/errors"
import { shouldLoadForUser } from "./requestCache"

type ProfileState = {
  profiles: ChatProfiles
  ready: boolean
  userId: string | null
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

function showNetworkErrorToast(error: unknown) {
  const message = getNetworkErrorMessage(error)
  if (message) useToastStore.getState().showToast(message)
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: emptyChatProfiles,
  ready: false,
  userId: null,
  error: null,
  loadProfiles: async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      pendingLoadProfiles = null
      pendingLoadProfilesUserId = null
      set({
        profiles: emptyChatProfiles,
        ready: true,
        userId: null,
        error: null,
      })
      return
    }

    const userId = user.id
    const state = useProfileStore.getState()
    if (state.userId !== userId) {
      set({
        profiles: emptyChatProfiles,
        ready: false,
        userId,
        error: null,
      })
    }
    if (
      state.userId === userId &&
      !shouldLoadForUser(
        { loaded: state.ready, loading: false, userId: state.userId },
        userId,
      )
    ) {
      return
    }

    if (pendingLoadProfiles && pendingLoadProfilesUserId === userId) {
      return pendingLoadProfiles
    }

    const request = useAuthStore
      .getState()
      .client.chatProfiles()
      .then((profiles) => {
        if (useAuthStore.getState().user?.id !== userId) return
        set({ profiles, ready: true, userId, error: null })
      })
      .catch((error) => {
        showNetworkErrorToast(error)
        if (useAuthStore.getState().user?.id !== userId) return
        set({
          ready: true,
          userId,
          error: getReadableErrorMessage(error, "聊天资料载入失败"),
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
    set({
      profiles: savedProfiles,
      ready: true,
      userId: useAuthStore.getState().user?.id ?? null,
      error: null,
    })
  },
}))
