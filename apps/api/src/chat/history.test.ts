import { describe, expect, it } from "vitest"
import { saveChatMessages } from "@/chat/history"
import type { Env } from "@/env"

describe("chat history", () => {
  it("saves expression group metadata with chat messages", async () => {
    const statements: Array<{
      sql: string
      values: unknown[]
    }> = []
    const env = {
      DB: {
        prepare: (sql: string) => ({
          bind: (...values: unknown[]) => {
            statements.push({ sql, values })
            return {}
          },
          all: async () => ({
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
          }),
        }),
        batch: async (queries: unknown[]) => queries,
      },
    } as unknown as Env

    await saveChatMessages(env, {
      userId: "u1",
      conversationId: "c1",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "我今天有点烦",
          created_at: 1,
          expression_group_id: "group-1",
          expression_part_index: 0,
        },
      ],
    })

    const insert = statements.find((statement) =>
      statement.sql.includes("INSERT OR IGNORE INTO chat_messages"),
    )
    expect(insert?.values).toEqual([
      "m1",
      "u1",
      "c1",
      "user",
      "我今天有点烦",
      1,
      "group-1",
      0,
    ])
  })
})
