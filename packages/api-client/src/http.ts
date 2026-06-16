import type {
  AuthTokens,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest,
  CreateGroupChatRequest,
  CreateChatConversationResponse,
  CreateSingleChatRequest,
  UpdateChatProfilesRequest,
  UpdateMeRequest,
  User,
  ChatConversationsResponse,
  ChatHistoryResponse,
  ChatHistoryRequest,
  ChatProfiles,
  MemoriesResponse,
  MemoryContextResponse,
  Memory,
  RelationshipResponse,
  UpdateMemoryRequest,
} from "@ai-companion/shared"
import {
  authResponseSchema,
  chatConversationsResponseSchema,
  createChatConversationResponseSchema,
  chatHistoryResponseSchema,
  chatProfilesSchema,
  memoryContextResponseSchema,
  memoriesResponseSchema,
  memorySchema,
  relationshipResponseSchema,
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
    sessionId?: string
  }): Promise<ChatHistoryResponse> {
    const searchParams = new URLSearchParams()
    const queryParams: Partial<ChatHistoryRequest> = {}
    if (input?.beforeId) queryParams.before_id = input.beforeId
    if (input?.limit) queryParams.limit = input.limit
    if (input?.sessionId) queryParams.session_id = input.sessionId
    if (queryParams.before_id) {
      searchParams.set("before_id", queryParams.before_id)
    }
    if (queryParams.limit) searchParams.set("limit", String(queryParams.limit))
    if (queryParams.session_id) {
      searchParams.set("session_id", queryParams.session_id)
    }
    const queryString = searchParams.toString()
    const data = await request<unknown>(
      `/chat/history${queryString ? `?${queryString}` : ""}`,
      undefined,
      { auth: true },
    )
    return chatHistoryResponseSchema.parse(data)
  }

  async function chatConversations(): Promise<ChatConversationsResponse> {
    const data = await request<unknown>("/chat/conversations", undefined, {
      auth: true,
    })
    return chatConversationsResponseSchema.parse(data)
  }

  async function createSingleChat(
    input: CreateSingleChatRequest,
  ): Promise<CreateChatConversationResponse> {
    const data = await request<unknown>(
      "/chat/conversations/single",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { auth: true },
    )
    return createChatConversationResponseSchema.parse(data)
  }

  async function createGroupChat(
    input: CreateGroupChatRequest,
  ): Promise<CreateChatConversationResponse> {
    const data = await request<unknown>(
      "/chat/conversations/group",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      { auth: true },
    )
    return createChatConversationResponseSchema.parse(data)
  }

  async function relationship(): Promise<RelationshipResponse> {
    const data = await request<unknown>("/chat/relationship", undefined, {
      auth: true,
    })
    return relationshipResponseSchema.parse(data)
  }

  async function memories(): Promise<MemoriesResponse> {
    const data = await request<unknown>("/memories", undefined, {
      auth: true,
    })
    return memoriesResponseSchema.parse(data)
  }

  async function memoryContext(id: string): Promise<MemoryContextResponse> {
    const data = await request<unknown>(
      `/memories/${encodeURIComponent(id)}/context`,
      undefined,
      { auth: true },
    )
    return memoryContextResponseSchema.parse(data)
  }

  async function updateMemory(
    id: string,
    input: UpdateMemoryRequest,
  ): Promise<Memory> {
    const data = await request<unknown>(
      `/memories/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      { auth: true },
    )
    return memorySchema.parse(data)
  }

  async function deleteMemory(id: string) {
    await request<{ ok: true }>(
      `/memories/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      { auth: true },
    )
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
    chatConversations,
    createSingleChat,
    createGroupChat,
    relationship,
    memories,
    memoryContext,
    updateMemory,
    deleteMemory,
  }
}
