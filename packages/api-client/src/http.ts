import type {
  AuthTokens,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest,
  UpdateChatProfilesRequest,
  UpdateMeRequest,
  User,
  ChatHistoryResponse,
  ChatProfiles,
} from "@ai-companion/shared"
import {
  authResponseSchema,
  chatHistoryResponseSchema,
  chatProfilesSchema,
  userSchema,
} from "@ai-companion/shared"

export type TokenStore = {
  getTokens: () => AuthTokens | null | Promise<AuthTokens | null>
  setTokens: (tokens: AuthTokens | null) => void | Promise<void>
}

export type HttpClientOptions = {
  baseUrl: string
  tokenStore?: TokenStore
}

export type HttpClient = ReturnType<typeof createHttpClient>

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = {
  auth?: boolean
  retryOnUnauthorized?: boolean
}

export function createHttpClient(options: HttpClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "")

  async function request<T>(
    path: string,
    init: RequestInit = {},
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const tokens = await options.tokenStore?.getTokens()
    const headers = new Headers(init.headers)
    headers.set("content-type", "application/json")
    if (requestOptions.auth && tokens?.access_token) {
      headers.set("authorization", `Bearer ${tokens.access_token}`)
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    })

    if (
      response.status === 401 &&
      requestOptions.auth &&
      requestOptions.retryOnUnauthorized !== false &&
      tokens?.refresh_token
    ) {
      const refreshed = await refresh({ refresh_token: tokens.refresh_token })
      await options.tokenStore?.setTokens(refreshed.tokens)
      return request<T>(path, init, {
        ...requestOptions,
        retryOnUnauthorized: false,
      })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new ApiError(response.status, data.error ?? "Request failed")
    }
    return data as T
  }

  async function register(input: RegisterRequest) {
    const data = await request<unknown>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    })
    const parsed = authResponseSchema.parse(data)
    await options.tokenStore?.setTokens(parsed.tokens)
    return parsed
  }

  async function login(input: LoginRequest) {
    const data = await request<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    })
    const parsed = authResponseSchema.parse(data)
    await options.tokenStore?.setTokens(parsed.tokens)
    return parsed
  }

  async function refresh(input: RefreshRequest) {
    const data = await request<unknown>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(input),
    })
    const parsed = authResponseSchema.parse(data)
    await options.tokenStore?.setTokens(parsed.tokens)
    return parsed
  }

  async function logout(input?: LogoutRequest) {
    const current = input ?? (await options.tokenStore?.getTokens())
    await request<{ ok: true }>(
      "/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: current?.refresh_token ?? "" }),
      },
      { auth: true, retryOnUnauthorized: false },
    )
    await options.tokenStore?.setTokens(null)
  }

  async function me(): Promise<User> {
    const data = await request<unknown>("/me", undefined, { auth: true })
    return userSchema.parse(data)
  }

  async function updateMe(input: UpdateMeRequest): Promise<User> {
    const data = await request<unknown>(
      "/me",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      { auth: true },
    )
    return userSchema.parse(data)
  }

  async function deleteAccount() {
    await request<{ ok: true }>(
      "/account",
      { method: "DELETE" },
      { auth: true },
    )
    await options.tokenStore?.setTokens(null)
  }

  async function chatProfiles(): Promise<ChatProfiles> {
    const data = await request<unknown>("/profiles/chat", undefined, {
      auth: true,
    })
    return chatProfilesSchema.parse(data)
  }

  async function updateChatProfiles(
    input: UpdateChatProfilesRequest,
  ): Promise<ChatProfiles> {
    const data = await request<unknown>(
      "/profiles/chat",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      { auth: true },
    )
    return chatProfilesSchema.parse(data)
  }

  async function chatHistory(input?: {
    beforeId?: string
    limit?: number
  }): Promise<ChatHistoryResponse> {
    const searchParams = new URLSearchParams()
    if (input?.beforeId) searchParams.set("before_id", input.beforeId)
    if (input?.limit) searchParams.set("limit", String(input.limit))
    const query = searchParams.toString()
    const data = await request<unknown>(
      `/chat/history${query ? `?${query}` : ""}`,
      undefined,
      { auth: true },
    )
    return chatHistoryResponseSchema.parse(data)
  }

  return {
    register,
    login,
    refresh,
    logout,
    me,
    updateMe,
    deleteAccount,
    chatProfiles,
    updateChatProfiles,
    chatHistory,
  }
}
