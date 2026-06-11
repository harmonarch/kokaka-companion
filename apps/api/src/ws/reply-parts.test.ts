import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChatMessage } from "@ai-companion/shared"
import { applyTokenMessage } from "../../../mobile/src/stores/chatMessages"
import type { Env } from "@/env"
import {
  buildReplyParts,
  isShortMessageBurst,
  splitReplyIntoParts,
  updateCollectedHistory,
} from "@/ws/chat"

describe("reply parts", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("detects only multiple short user messages as a short burst", () => {
    expect(
      isShortMessageBurst([
        { id: "u1", sessionId: "c1", content: "想你", receivedAt: 1 },
        { id: "u2", sessionId: "c1", content: "嘿嘿", receivedAt: 2 },
      ]),
    ).toBe(true)
    expect(
      isShortMessageBurst([
        { id: "u1", sessionId: "c1", content: "想你", receivedAt: 1 },
      ]),
    ).toBe(false)
    expect(
      isShortMessageBurst([
        { id: "u1", sessionId: "c1", content: "想你", receivedAt: 1 },
        {
          id: "u2",
          sessionId: "c1",
          content: "今天发生了很多很多事情，真的不知道应该怎么讲清楚",
          receivedAt: 2,
        },
      ]),
    ).toBe(false)
  })

  it("splits a short-burst reply into natural parts", () => {
    expect(
      splitReplyIntoParts("嘿嘿，我也想你了～🥰 今天过得开心吗？"),
    ).toEqual(["嘿嘿，我也想你了～🥰", "今天过得开心吗？"])
    expect(
      splitReplyIntoParts("第一句。第二句！第三句？第四句。第五句。"),
    ).toEqual(["第一句。", "第二句！", "第三句？", "第四句。第五句。"])
  })

  it("stores split agent replies as multiple messages", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")

    const replaced: Array<{
      sql: string
      values: unknown[]
    }> = []
    const kvPuts: Array<{ key: string; value: string }> = []
    const env = {
      DB: {
        prepare: (sql: string) => ({
          bind: (...values: unknown[]) => {
            replaced.push({ sql, values })
            return {
              all: async () => ({ results: [] }),
            }
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
      CHAT_CONTEXT: {
        put: async (key: string, value: string) => {
          kvPuts.push({ key, value })
        },
      },
    } as unknown as Env

    const replyParts = buildReplyParts(
      "嘿嘿，我也想你了～🥰 今天过得开心吗？",
      true,
    )
    const context: ChatMessage[] = [
      {
        id: "synthetic-user",
        role: "user",
        content: "想你\n嘿嘿",
        created_at: 10,
      },
      {
        id: "synthetic-agent",
        role: "agent",
        content: "嘿嘿，我也想你了～🥰 今天过得开心吗？",
        created_at: 11,
      },
    ]

    const messages = await updateCollectedHistory(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending: [
        { id: "u1-message-1", sessionId: "c1", content: "想你", receivedAt: 1 },
        { id: "u1-message-2", sessionId: "c1", content: "嘿嘿", receivedAt: 2 },
      ],
      reply: "嘿嘿，我也想你了～🥰 今天过得开心吗？",
      replyParts,
      context,
    })

    expect(messages.filter((message) => message.role === "agent")).toEqual([
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000001",
        content: "嘿嘿，我也想你了～🥰",
        expression_group_id: "group-1",
        expression_part_index: 0,
      }),
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000002",
        content: "今天过得开心吗？",
        expression_group_id: "group-1",
        expression_part_index: 1,
      }),
    ])
    expect(
      replaced.some(
        (statement) =>
          statement.sql.includes("DELETE FROM chat_messages") &&
          statement.values.includes("synthetic-agent"),
      ),
    ).toBe(true)
    expect(JSON.parse(kvPuts[0].value).messages).toHaveLength(4)
  })

  it("turns reply part tokens into separate mobile bubbles", () => {
    const first = applyTokenMessage(
      [],
      {
        type: "token",
        topic_id: "default",
        delta: "嘿嘿，我也想你了～",
        message_id: "agent-1",
        expression_group_id: "group-1",
        expression_part_index: 0,
        expression_part_total: 2,
      },
      { id: () => "fallback", now: () => 100 },
    )
    const second = applyTokenMessage(
      first,
      {
        type: "token",
        topic_id: "default",
        delta: "今天过得开心吗？",
        message_id: "agent-2",
        expression_group_id: "group-1",
        expression_part_index: 1,
        expression_part_total: 2,
      },
      { id: () => "fallback", now: () => 100 },
    )

    expect(second).toEqual([
      expect.objectContaining({
        id: "agent-2",
        content: "今天过得开心吗？",
        expression_part_index: 1,
      }),
      expect.objectContaining({
        id: "agent-1",
        content: "嘿嘿，我也想你了～",
        expression_part_index: 0,
      }),
    ])
  })
})
