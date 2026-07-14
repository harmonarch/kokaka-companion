import { describe, expect, it } from "vitest"
import {
  chatMessageExists,
  ensureChatMessagesTable,
  saveChatMessages,
} from "@/chat/history"
import type { Env } from "@/env"

describe("chat history", () => {
  it("adds trace_id to an existing chat_messages table", async () => {
    const alteredColumns: string[] = []
    const env = {
      DB: {
        prepare: (sql: string) => ({
          all: async () => ({
            results: [
              { name: "id" },
              { name: "agent_id" },
              { name: "agent_name" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
            ],
          }),
          run: async () => {
            alteredColumns.push(sql)
          },
        }),
        batch: async (queries: unknown[]) => queries,
      },
    } as unknown as Env

    await ensureChatMessagesTable(env)

    expect(alteredColumns).toEqual([
      "ALTER TABLE chat_messages ADD COLUMN trace_id TEXT",
    ])
  })

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
              { name: "agent_id" },
              { name: "agent_name" },
              { name: "content" },
              { name: "created_at" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
              { name: "trace_id" },
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
          agent_id: null,
          agent_name: null,
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
      null,
      null,
      "我今天有点烦",
      1,
      "group-1",
      0,
      null,
    ])
  })

  it("saves single and group messages under separate conversations", async () => {
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
              { name: "agent_id" },
              { name: "agent_name" },
              { name: "content" },
              { name: "created_at" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
              { name: "trace_id" },
            ],
          }),
        }),
        batch: async (queries: unknown[]) => queries,
      },
    } as unknown as Env

    await saveChatMessages(env, {
      userId: "u1",
      conversationId: "chat:agent-1",
      messages: [
        {
          id: "single-1",
          role: "user",
          content: "单聊消息",
          created_at: 1,
        },
      ],
    })
    await saveChatMessages(env, {
      userId: "u1",
      conversationId: "group-1",
      messages: [
        {
          id: "group-1",
          role: "user",
          content: "群聊消息",
          created_at: 2,
        },
      ],
    })

    const inserts = statements.filter((statement) =>
      statement.sql.includes("INSERT OR IGNORE INTO chat_messages"),
    )
    expect(inserts.map((insert) => insert.values[2])).toEqual([
      "chat:agent-1",
      "group-1",
    ])
  })

  it("checks whether a user message was already saved", async () => {
    const env = {
      DB: {
        prepare: (sql: string) => ({
          bind: (...values: unknown[]) => ({
            first: async () =>
              sql.includes("SELECT id FROM chat_messages") &&
              values[0] === "u1" &&
              values[1] === "m1"
                ? { id: "m1" }
                : null,
          }),
          all: async () => ({
            results: [
              { name: "id" },
              { name: "user_id" },
              { name: "conversation_id" },
              { name: "role" },
              { name: "agent_id" },
              { name: "agent_name" },
              { name: "content" },
              { name: "created_at" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
              { name: "trace_id" },
            ],
          }),
        }),
        batch: async (queries: unknown[]) => queries,
      },
    } as unknown as Env

    await expect(
      chatMessageExists(env, { userId: "u1", messageId: "m1" }),
    ).resolves.toBe(true)
    await expect(
      chatMessageExists(env, { userId: "u1", messageId: "missing" }),
    ).resolves.toBe(false)
  })
})
