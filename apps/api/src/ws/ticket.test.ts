import { describe, expect, it } from "vitest"
import type { Env } from "@/env"
import { consumeWsTicket, createWsTicket } from "./ticket"

function createFakeEnv() {
  const store = new Map<string, string>()
  const chatContext = {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
  }
  return { env: { CHAT_CONTEXT: chatContext } as unknown as Env, store }
}

describe("ws ticket", () => {
  it("creates a ticket and consumes it once", async () => {
    const { env, store } = createFakeEnv()

    const ticket = await createWsTicket(env, "user-1")
    expect(ticket).toBeTruthy()
    expect(store.get(`ticket:${ticket}`)).toBe("user-1")

    expect(await consumeWsTicket(env, ticket)).toBe("user-1")
  })

  it("returns null when consuming the same ticket twice", async () => {
    const { env } = createFakeEnv()

    const ticket = await createWsTicket(env, "user-1")
    await consumeWsTicket(env, ticket)
    expect(await consumeWsTicket(env, ticket)).toBeNull()
  })

  it("returns null for an unknown ticket", async () => {
    const { env } = createFakeEnv()

    expect(await consumeWsTicket(env, "missing")).toBeNull()
  })
})
