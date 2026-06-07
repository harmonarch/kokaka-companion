import type { AuthTokens, User } from "@ai-companion/shared"
import { createHttpClient } from "@ai-companion/api-client"
import { create } from "zustand"
import { loadTokens, saveTokens } from "@/utils/storage"
import { apiBaseUrl } from "@/config/api"

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
  const client = createHttpClient({
    baseUrl: apiBaseUrl,
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
      set({ tokens, ready: true })
      if (tokens) {
        await get()
          .refreshUser()
          .catch(() => set({ user: null, tokens: null }))
      }
    },
    register: async (email, password, nickname) => {
      const response = await client.register({ email, password, nickname })
      set({ user: response.user, tokens: response.tokens, error: null })
    },
    login: async (email, password) => {
      const response = await client.login({ email, password })
      set({ user: response.user, tokens: response.tokens, error: null })
    },
    refreshUser: async () => {
      const user = await client.me()
      set({ user, error: null })
    },
    updateNickname: async (nickname) => {
      const user = await client.updateMe({ nickname })
      set({ user, error: null })
    },
    logout: async () => {
      await client.logout().catch(() => undefined)
      set({ user: null, tokens: null })
      await saveTokens(null)
    },
    deleteAccount: async () => {
      await client.deleteAccount()
      set({ user: null, tokens: null })
      await saveTokens(null)
    },
  }
})
