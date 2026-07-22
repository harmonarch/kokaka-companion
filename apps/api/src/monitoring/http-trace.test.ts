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
  it("preserves audio content type, authorization, and trace id", async () => {
    const audio = new Blob(["voice"], { type: "audio/webm;codecs=opus" })
    const controller = new AbortController()
    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe("https://api.example.com/audio/transcriptions")
      const headers = new Headers(init?.headers)
      expect(headers.get("content-type")).toBe("audio/webm;codecs=opus")
      expect(headers.get("authorization")).toBe("Bearer access")
      expect(headers.get("x-trace-id")).toBe("trace-audio")
      expect(init?.body).toBe(audio)
      expect(init?.signal).toBe(controller.signal)
      return Response.json({ text: "你好" })
    }
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      createTraceId: () => "trace-audio",
      tokenStore: {
        getTokens: () => ({
          access_token: "access",
          refresh_token: "refresh",
        }),
        setTokens: () => undefined,
      },
    })

    await expect(
      client.transcribeAudio(audio, controller.signal),
    ).resolves.toEqual({
      text: "你好",
    })
  })

  it("replays the same audio after refreshing an expired token", async () => {
    const audio = new Blob(["voice"], { type: "audio/mp4" })
    let tokens = {
      access_token: "old-access",
      refresh_token: "old-refresh",
    }
    const audioAttempts: Array<{
      authorization: string | null
      body: BodyInit | null | undefined
    }> = []
    globalThis.fetch = async (url, init) => {
      const path = new URL(String(url)).pathname
      if (path === "/auth/refresh") {
        return Response.json({
          user: { id: "u1", email: "u@example.com", nickname: "u" },
          tokens: {
            access_token: "new-access",
            refresh_token: "new-refresh",
          },
        })
      }
      audioAttempts.push({
        authorization: new Headers(init?.headers).get("authorization"),
        body: init?.body,
      })
      if (audioAttempts.length === 1) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }
      return Response.json({ text: "重试成功" })
    }
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      tokenStore: {
        getTokens: () => tokens,
        setTokens: (nextTokens) => {
          if (nextTokens) tokens = nextTokens
        },
      },
    })

    await expect(client.transcribeAudio(audio)).resolves.toEqual({
      text: "重试成功",
    })
    expect(audioAttempts.map((attempt) => attempt.authorization)).toEqual([
      "Bearer old-access",
      "Bearer new-access",
    ])
    expect(audioAttempts.every((attempt) => attempt.body === audio)).toBe(true)
  })

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
