import { hashClientPassword } from "@ai-companion/shared"
import type { AuthTokens, User } from "@ai-companion/shared"
import { createHttpClient } from "@ai-companion/api-client"
import { create } from "zustand"
import {
  loadJson,
  loadTokens,
  loadUser,
  saveJson,
  saveTokens,
  saveUser,
} from "@/utils/storage"
import { getUserAfterRefreshError } from "./authSession"
import { apiBaseUrl } from "@/config/api"
import { clearPendingOutgoing } from "./chatReliability"
import { createTraceId, recordHttpObservation } from "@/monitoring/sentry"

type AuthState = {
  user: User | null
  tokens: AuthTokens | null
  ready: boolean
  error: string | null
  client: ReturnType<typeof createHttpClient>
  hydrate: () => Promise<void>
  register: (
    email: string,
    password: string,
    nickname?: string,
  ) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => {
  const clearSessionLocally = async () => {
    set({ user: null, tokens: null })
    await saveTokens(null)
    await saveUser(null)
    await clearPendingOutgoing({ loadJson, saveJson })
  }

  const client = createHttpClient({
    baseUrl: apiBaseUrl,
    createTraceId,
    onRequestComplete: recordHttpObservation,
    onRequestError: recordHttpObservation,
    tokenStore: {
      getTokens: () => get().tokens,
      setTokens: async (tokens) => {
        await saveTokens(tokens)
        set({ tokens })
      },
    },
  })

  return {
    user: null,
    tokens: null,
    ready: false,
    error: null,
    client,
    hydrate: async () => {
      const tokens = await loadTokens()
      if (!tokens) {
        set({ user: null, tokens: null, ready: true })
        return
      }

      set({ tokens, ready: false })
      try {
        await get().refreshUser()
        set({ ready: true })
      } catch (error) {
        const cachedUser = await loadUser()
        const offlineUser = getUserAfterRefreshError(error, cachedUser, tokens)
        if (offlineUser) {
          set({ user: offlineUser, ready: true })
          return
        }
        set({ user: null, tokens: null, ready: true })
        await saveTokens(null)
        await saveUser(null)
        await clearPendingOutgoing({ loadJson, saveJson })
      }
    },
    register: async (email, password, nickname) => {
      const password_hash = hashClientPassword(password)
      const response = await client.register({ email, password_hash, nickname })
      set({ user: response.user, tokens: response.tokens, error: null })
      await saveUser(response.user)
    },
    login: async (email, password) => {
      const password_hash = hashClientPassword(password)
      const response = await client.login({ email, password_hash })
      set({ user: response.user, tokens: response.tokens, error: null })
      await saveUser(response.user)
    },
    refreshUser: async () => {
      const user = await client.me()
      set({ user, error: null })
      await saveUser(user)
    },
    updateNickname: async (nickname) => {
      const user = await client.updateMe({ nickname })
      set({ user, error: null })
      await saveUser(user)
    },
    logout: async () => {
      await client.logout().catch(() => undefined)
      await clearSessionLocally()
    },
    deleteAccount: async () => {
      await client.deleteAccount()
      await clearSessionLocally()
    },
  }
})
