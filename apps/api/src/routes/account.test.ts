import { describe, expect, it, vi } from "vitest"
import { accountRoutes } from "@/routes/account"
import { longTermMemoryCacheKey } from "@/agent/memory/longTermMemory"
import type { Env } from "@/env"

vi.mock("@/auth/session", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    id: "u1",
    email: "u1@example.com",
    nickname: "小林",
  }),
}))

function createEnvFixture() {
  const deletedKeys: string[] = []
  const deletedTables: string[] = []
  const updates: string[] = []

  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return this
        },
        async run() {
          if (sql.startsWith("DELETE FROM")) {
            deletedTables.push(sql.match(/DELETE FROM (\w+)/)?.[1] ?? sql)
          }
          if (sql.startsWith("UPDATE")) updates.push(sql)
          return { success: true }
        },
      }
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) {
        await statement.run()
      }
    },
  }

  const env = {
    DB: db,
    CHAT_CONTEXT: {
      async delete(key: string) {
        deletedKeys.push(key)
      },
    },
  } as unknown as Env

  return { env, deletedKeys, deletedTables, updates }
}

describe("account routes", () => {
  it("clears short-term context, mood and long-term memory cache on account deletion", async () => {
    const { env, deletedKeys, deletedTables, updates } = createEnvFixture()

    const response = await accountRoutes.request(
      new Request("http://localhost/", {
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(updates).toHaveLength(2)
    expect(deletedKeys).toEqual([
      "ctx:u1",
      "mood:u1",
      longTermMemoryCacheKey("u1"),
    ])
    expect(deletedTables).toEqual([
      "user_profiles",
      "memories",
      "conversation_summaries",
      "chat_messages",
    ])
  })
})
