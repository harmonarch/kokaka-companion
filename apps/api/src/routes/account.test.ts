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
  const deletedVectorIds: string[] = []
  const updates: string[] = []
  const contextKeys = new Set([
    "ctx:u1:c1",
    "ctx:u1:c2",
    "ctx:other:c1",
    "ctx:u1",
  ])

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
        async all() {
          if (sql.startsWith("SELECT id FROM memories")) {
            return { results: [{ id: "m1" }, { id: "m2" }] }
          }
          return {
            results: [
              { name: "id" },
              { name: "user_id" },
              { name: "conversation_id" },
              { name: "role" },
              { name: "content" },
              { name: "created_at" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
            ],
          }
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
      async list(options: { prefix?: string }) {
        return {
          keys: [...contextKeys]
            .filter((key) => key.startsWith(options.prefix ?? ""))
            .map((name) => ({ name })),
          list_complete: true,
        }
      },
      async delete(key: string) {
        contextKeys.delete(key)
        deletedKeys.push(key)
      },
    },
    MEMORY_VECTORIZE: {
      async deleteByIds(ids: string[]) {
        deletedVectorIds.push(...ids)
      },
    },
  } as unknown as Env

  return { env, deletedKeys, deletedTables, deletedVectorIds, updates, contextKeys }
}

describe("account routes", () => {
  it("clears memory vectors, context, mood and cache before soft-deleting on account deletion", async () => {
    const {
      env,
      deletedKeys,
      deletedTables,
      deletedVectorIds,
      updates,
      contextKeys,
    } = createEnvFixture()

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
    expect(deletedVectorIds).toEqual(["m1", "m2"])
    expect(deletedTables).toEqual([
      "user_profiles",
      "memories",
      "conversation_summaries",
      "chat_messages",
      "chat_profiles",
      "chat_conversation_agents",
      "chat_conversations",
      "chat_agents",
      "relationship_states",
    ])
    expect(updates).toEqual([
      expect.stringContaining("UPDATE users SET deleted_at"),
      expect.stringContaining("UPDATE refresh_tokens SET revoked_at"),
    ])
    expect(deletedKeys).toEqual([
      "ctx:u1",
      "ctx:u1:c1",
      "ctx:u1:c2",
      "mood:u1",
      longTermMemoryCacheKey("u1"),
    ])
    expect([...contextKeys]).toEqual(["ctx:other:c1"])
  })
})
