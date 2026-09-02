import { expect, test } from "vitest"
import { createHttpClient } from "./http"
import type { AuthTokens } from "@ai-companion/shared"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const userBody = { id: "u1", email: "u1@example.com", nickname: null }

function installFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const original = globalThis.fetch
  globalThis.fetch = handler as unknown as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

test("concurrent 401s trigger a single refresh and retry with the new token", async () => {
  let refreshCalls = 0
  let currentTokens: AuthTokens | null = {
    access_token: "expired",
    refresh_token: "rt1",
  }
  const authorized: string[] = []

  const restore = installFetch(async (url, init) => {
    const path = String(url)
    const auth = new Headers(init?.headers).get("authorization")

    if (path.endsWith("/auth/refresh")) {
      refreshCalls += 1
      // Simulate latency so the concurrent 401 handlers pile up before the
      // refresh settles — otherwise single-flight would never be exercised.
      await new Promise((resolve) => setTimeout(resolve, 20))
      return jsonResponse(200, {
        user: userBody,
        tokens: { access_token: "new-access", refresh_token: "rt2" },
      })
    }

    if (path.endsWith("/me")) {
      if (auth === "Bearer new-access") {
        authorized.push(auth)
        return jsonResponse(200, userBody)
      }
      return jsonResponse(401, { error: "expired" })
    }

    return jsonResponse(404, { error: "not found" })
  })

  try {
    const client = createHttpClient({
      baseUrl: "https://example.com",
      tokenStore: {
        getTokens: () => currentTokens,
        setTokens: async (tokens) => {
          currentTokens = tokens
        },
      },
    })

    const results = await Promise.all([client.me(), client.me(), client.me()])

    expect(refreshCalls).toBe(1)
    expect(results).toHaveLength(3)
    expect(authorized).toHaveLength(3)
    expect(authorized.every((value) => value === "Bearer new-access")).toBe(
      true,
    )
  } finally {
    restore()
  }
})

test("refresh returning 401 triggers onUnauthorized exactly once", async () => {
  let onUnauthorizedCalls = 0
  let currentTokens: AuthTokens | null = {
    access_token: "expired",
    refresh_token: "rt1",
  }

  const restore = installFetch(async (url) => {
    const path = String(url)
    if (path.endsWith("/auth/refresh")) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return jsonResponse(401, { error: "Invalid refresh token" })
    }
    if (path.endsWith("/me")) return jsonResponse(401, { error: "expired" })
    return jsonResponse(404, { error: "not found" })
  })

  try {
    const client = createHttpClient({
      baseUrl: "https://example.com",
      tokenStore: {
        getTokens: () => currentTokens,
        setTokens: async (tokens) => {
          currentTokens = tokens
        },
      },
      onUnauthorized: async () => {
        onUnauthorizedCalls += 1
      },
    })

    const results = await Promise.allSettled([client.me(), client.me()])

    expect(results.filter((r) => r.status === "rejected")).toHaveLength(2)
    expect(onUnauthorizedCalls).toBe(1)
  } finally {
    restore()
  }
})

test("does not refresh when there is no refresh token", async () => {
  let refreshCalls = 0
  let onUnauthorizedCalls = 0

  const restore = installFetch(async (url) => {
    const path = String(url)
    if (path.endsWith("/auth/refresh")) {
      refreshCalls += 1
      return jsonResponse(200, { user: userBody, tokens: {} })
    }
    if (path.endsWith("/me")) return jsonResponse(401, { error: "expired" })
    return jsonResponse(404, { error: "not found" })
  })

  try {
    const client = createHttpClient({
      baseUrl: "https://example.com",
      tokenStore: {
        getTokens: () =>
          ({ access_token: "expired", refresh_token: "" }) as AuthTokens,
        setTokens: async () => {},
      },
      onUnauthorized: async () => {
        onUnauthorizedCalls += 1
      },
    })

    await expect(client.me()).rejects.toMatchObject({ status: 401 })
    expect(refreshCalls).toBe(0)
    expect(onUnauthorizedCalls).toBe(1)
  } finally {
    restore()
  }
})
