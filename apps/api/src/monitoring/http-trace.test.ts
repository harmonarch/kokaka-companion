import { afterEach, describe, expect, it } from "vitest"
import {
  createHttpClient,
  type HttpRequestObservation,
} from "../../../../packages/api-client/src/http"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("HTTP trace correlation", () => {
  it("sends and observes the trace id without query values", async () => {
    const observations: HttpRequestObservation[] = []
    globalThis.fetch = async (_url, init) => {
      expect(new Headers(init?.headers).get("x-trace-id")).toBe("trace-1")
      return new Response(JSON.stringify({ messages: [], has_more: false }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-trace-id": "trace-1",
        },
      })
    }
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      createTraceId: () => "trace-1",
      onRequestComplete: (observation) => observations.push(observation),
    })

    await client.chatHistory({ beforeId: "secret-cursor" })

    expect(observations[0]).toMatchObject({
      traceId: "trace-1",
      path: "/chat/history",
    })
  })

  it("reuses the original trace id after refreshing an expired token", async () => {
    const historyTraceIds: string[] = []
    let historyAttempts = 0
    globalThis.fetch = async (url, init) => {
      const path = new URL(String(url)).pathname
      const traceId = new Headers(init?.headers).get("x-trace-id") ?? ""
      if (path === "/auth/refresh") {
        return new Response(
          JSON.stringify({
            user: { id: "u1", email: "u@example.com", nickname: "u" },
            tokens: {
              access_token: "new-access",
              refresh_token: "new-refresh",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      historyAttempts += 1
      historyTraceIds.push(traceId)
      if (historyAttempts === 1) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      }
      return new Response(JSON.stringify({ messages: [], has_more: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    let nextTrace = 0
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      createTraceId: () => `trace-${++nextTrace}`,
      tokenStore: {
        getTokens: () => ({
          access_token: "old-access",
          refresh_token: "old-refresh",
        }),
        setTokens: () => undefined,
      },
    })

    await client.chatHistory()

    expect(historyTraceIds).toEqual(["trace-1", "trace-1"])
  })
})
