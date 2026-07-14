import { describe, expect, it, vi } from "vitest"
import { resolveTraceId, sentryOptions } from "./sentry"
import type { Env } from "@/env"

describe("Sentry monitoring configuration", () => {
  it("stays disabled when no DSN is configured", () => {
    const options = sentryOptions({} as Env)

    expect(options.enabled).toBe(false)
    expect(options.tracesSampleRate).toBe(0.1)
  })

  it("accepts a safe incoming trace id", () => {
    expect(resolveTraceId("trace_123:mobile")).toBe("trace_123:mobile")
  })

  it("replaces unsafe trace ids", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "generated-trace-id" })

    expect(resolveTraceId("Bearer secret value")).toBe("generated-trace-id")
    expect(resolveTraceId("x".repeat(129))).toBe("generated-trace-id")

    vi.unstubAllGlobals()
  })

  it("removes request secrets before sending an event", () => {
    const options = sentryOptions({ SENTRY_DSN: "https://dsn" } as Env)
    const event = options.beforeSend({
      type: undefined,
      request: {
        url: "https://api.example.com/ws/chat?token=secret",
        headers: { authorization: "Bearer secret" },
        data: { content: "private chat" },
        cookies: { session: "secret" },
        query_string: "token=secret",
      },
      user: { id: "u1", email: "private@example.com" },
    })

    expect(event.request).toEqual({ url: "https://api.example.com/ws/chat" })
    expect(event.user).toEqual({ id: "u1" })
  })
})
