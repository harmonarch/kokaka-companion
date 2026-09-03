import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChatMessage } from "@ai-companion/shared"
import { applyTokenMessage } from "../../../mobile/src/stores/chatMessages"
import type { Env } from "@/env"
import { createAccessToken } from "@/auth/tokens"
import {
  appendCollectedHistory,
  acknowledgeChatMessage,
  buildReplyParts,
  isShortMessageBurst,
  persistVisibleReplyParts,
  replyPartDelayMs,
  selectReplySpeakers,
  splitReplyIntoParts,
  updateCollectedHistory,
  withReplySpeakers,
} from "@/ws/chat"

type DbRow = {
  id: string
  user_id: string
  conversation_id: string
  role: "user" | "agent"
  agent_id: string | null
  agent_name: string | null
  content: string
  created_at: number
  expression_group_id: string | null
  expression_part_index: number | null
  rowid: number
}

function createMemoryEnv() {
  const rows: DbRow[] = []
  let rowid = 1
  const snapshots: DbRow[][] = []

  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          run: async () => {
            if (sql.startsWith("DELETE FROM chat_messages")) {
              const [userId, id] = values
              const index = rows.findIndex(
                (row) => row.user_id === userId && row.id === id,
              )
              if (index >= 0) rows.splice(index, 1)
            }
            return { success: true }
          },
          __values: sql.includes("INSERT OR IGNORE INTO chat_messages")
            ? values
            : undefined,
          first: async <T>() => {
            if (sql.includes("FROM users")) {
              return {
                id: "u1",
                email: "u1@example.com",
                nickname: "小林",
              } as T
            }
            if (sql.includes("SELECT created_at AS createdAt")) {
              const [userId, id] = values
              const row = rows.find(
                (item) => item.user_id === userId && item.id === id,
              )
              return row
                ? ({
                    createdAt: row.created_at,
                    rowId: row.rowid,
                  } as T)
                : null
            }
            if (sql.includes("SELECT id FROM chat_messages")) {
              const [userId, id] = values
              const row = rows.find(
                (item) => item.user_id === userId && item.id === id,
              )
              return row ? ({ id: row.id } as T) : null
            }
            return null
          },
          all: async <T>() => {
            if (sql.includes("FROM chat_messages")) {
              const userId = values[0]
              const limit = Number(values.at(-1))
              const conversationId = sql.includes("conversation_id = ?")
                ? values[1]
                : null
              const selected = rows
                .filter(
                  (row) =>
                    row.user_id === userId &&
                    (!conversationId || row.conversation_id === conversationId),
                )
                .sort((a, b) => {
                  if (a.created_at !== b.created_at) {
                    return b.created_at - a.created_at
                  }
                  return b.rowid - a.rowid
                })
                .slice(0, limit)
              return { results: selected as T[] }
            }
            return { results: [] as T[] }
          },
        }),
        all: async <T>() => ({
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
          ] as T[],
        }),
      }),
      batch: async (
        statements: Array<{ run?: () => Promise<unknown>; __values?: unknown[] }>,
      ) => {
        for (const statement of statements) {
          const values = statement.__values
          if (values) {
            const [
              id,
              userId,
              conversationId,
              role,
              agentId,
              agentName,
              content,
              createdAt,
              expressionGroupId,
              expressionPartIndex,
            ] = values
            if (!rows.some((row) => row.id === id)) {
              rows.push({
                id: String(id),
                user_id: String(userId),
                conversation_id: String(conversationId),
                role: role as "user" | "agent",
                agent_id: agentId == null ? null : String(agentId),
                agent_name: agentName == null ? null : String(agentName),
                content: String(content),
                created_at: Number(createdAt),
                expression_group_id:
                  expressionGroupId == null ? null : String(expressionGroupId),
                expression_part_index:
                  expressionPartIndex == null ? null : Number(expressionPartIndex),
                rowid,
              })
              rowid += 1
            }
          } else if (statement.run) {
            await statement.run()
          }
        }
        snapshots.push(rows.map((row) => ({ ...row })))
      },
    },
    CHAT_CONTEXT: {
      put: vi.fn().mockResolvedValue(undefined),
    },
    JWT_SECRET: "test-secret",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    REFRESH_TOKEN_TTL_SECONDS: "604800",
    PASSWORD_HASH_SECRET: "password-secret",
    LLM_PROVIDER: "deepseek",
    DEEPSEEK_BASE_URL: "https://example.com",
    DEEPSEEK_MODEL: "deepseek-chat",
  } as unknown as Env

  return { env, rows, snapshots }
}

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

  it("removes periods from reply bubble endings", () => {
    expect(buildReplyParts("第一句。第二句！Third.", true)).toEqual([
      expect.objectContaining({ content: "第一句" }),
      expect.objectContaining({ content: "第二句！" }),
      expect.objectContaining({ content: "Third" }),
    ])
  })

  it("assigns group reply parts to named agents", () => {
    const speakers = selectReplySpeakers(
      [
        { id: "agent-1", name: "安安", persona_prompt: "慢一点说" },
        { id: "agent-2", name: "晴晴", persona_prompt: "帮我看行动" },
      ],
      "安安先说说",
    )

    expect(speakers).toEqual([{ id: "agent-1", name: "安安" }])
    expect(
      withReplySpeakers(
        [
          { id: "reply-1", content: "先慢一点", index: 0, total: 1 },
        ],
        speakers,
      ),
    ).toEqual([
      {
        id: "reply-1",
        content: "先慢一点",
        index: 0,
        total: 1,
        agentId: "agent-1",
        agentName: "安安",
      },
    ])
  })

  it("uses up to two group agents when nobody is named", () => {
    const speakers = selectReplySpeakers(
      [
        { id: "agent-1", name: "安安", persona_prompt: "慢一点说" },
        { id: "agent-2", name: "晴晴", persona_prompt: "帮我看行动" },
        { id: "agent-3", name: "南南", persona_prompt: "补充风险" },
      ],
      "大家说说",
    )

    expect(speakers).toEqual([
      { id: "agent-1", name: "安安" },
      { id: "agent-2", name: "晴晴" },
    ])
  })

  it("keeps single chat speaker metadata when one agent is active", () => {
    expect(
      selectReplySpeakers(
        [{ id: "agent-1", name: "安安", persona_prompt: "慢一点说" }],
        "今天好累",
      ),
    ).toEqual([{ id: "agent-1", name: "安安" }])
  })

  it("waits between reply parts based on visible text length", () => {
    expect(replyPartDelayMs("好")).toBe(2200)
    expect(replyPartDelayMs("一二三四五六七八九十")).toBe(4000)
    expect(replyPartDelayMs("一二三四五六七八九十一二三四五")).toBe(5000)
    expect(replyPartDelayMs("一二三四五六七八九十一二三四五六")).toBe(5000)
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
              { name: "agent_id" },
              { name: "agent_name" },
              { name: "content" },
              { name: "created_at" },
              { name: "expression_group_id" },
              { name: "expression_part_index" },
              { name: "trace_id" },
            ],
          }),
          run: async () => ({ success: true }),
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

  it("persists each visible reply part immediately", async () => {
    const { env, rows } = createMemoryEnv()
    const context: ChatMessage[] = [
      {
        id: "synthetic-user",
        role: "user",
        content: "想你\n嘿嘿\n在吗",
        created_at: 10,
      },
      {
        id: "synthetic-agent",
        role: "agent",
        content: "在呀。我也想你。刚刚在等你。",
        created_at: 20,
      },
    ]
    const pending = [
      { id: "user-1", sessionId: "c1", content: "想你", receivedAt: 1 },
      { id: "user-2", sessionId: "c1", content: "嘿嘿", receivedAt: 2 },
      { id: "user-3", sessionId: "c1", content: "在吗", receivedAt: 3 },
    ]
    const replyParts = withReplySpeakers(
      [
        { id: "agent-1", content: "在呀", index: 0, total: 4 },
        { id: "agent-2", content: "我也想你", index: 1, total: 4 },
        { id: "agent-3", content: "刚刚在等你", index: 2, total: 4 },
        { id: "agent-4", content: "现在我在", index: 3, total: 4 },
      ],
      [
        { id: "agent:xiaolian", name: "小练" },
        { id: "agent:anan", name: "安安" },
      ],
    )

    let currentContext = await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending,
      reply: "在呀。我也想你。刚刚在等你。现在我在。",
      replyParts: replyParts.slice(0, 1),
      context,
      replaceSynthetic: true,
    })

    expect(rows.filter((row) => row.role === "agent")).toHaveLength(1)
    expect(rows.filter((row) => row.role === "user")).toHaveLength(3)

    currentContext = await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending,
      reply: "在呀。我也想你。刚刚在等你。现在我在。",
      replyParts: replyParts.slice(0, 2),
      context: currentContext,
      replaceSynthetic: false,
    })

    expect(rows.filter((row) => row.role === "agent")).toHaveLength(2)

    currentContext = await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending,
      reply: "在呀。我也想你。刚刚在等你。现在我在。",
      replyParts: replyParts.slice(0, 3),
      context: currentContext,
      replaceSynthetic: false,
    })

    expect(rows.filter((row) => row.role === "agent")).toHaveLength(3)

    await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending,
      reply: "在呀。我也想你。刚刚在等你。现在我在。",
      replyParts,
      context: currentContext,
      replaceSynthetic: false,
    })

    const agentRows = rows
      .filter((row) => row.role === "agent")
      .sort((a, b) => Number(a.expression_part_index) - Number(b.expression_part_index))
    expect(agentRows).toEqual([
      expect.objectContaining({
        content: "在呀",
        agent_id: "agent:xiaolian",
        agent_name: "小练",
        expression_group_id: "group-1",
        expression_part_index: 0,
      }),
      expect.objectContaining({
        content: "我也想你",
        agent_id: "agent:anan",
        agent_name: "安安",
        expression_group_id: "group-1",
        expression_part_index: 1,
      }),
      expect.objectContaining({
        content: "刚刚在等你",
        expression_group_id: "group-1",
        expression_part_index: 2,
      }),
      expect.objectContaining({
        content: "现在我在",
        expression_group_id: "group-1",
        expression_part_index: 3,
      }),
    ])
  })

  it("drops undisplayed reply parts when a new user message interrupts the old reply", async () => {
    const { env, rows } = createMemoryEnv()

    await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "synthetic-user",
      pending: [
        { id: "user-1", sessionId: "c1", content: "想你", receivedAt: 1 },
        { id: "user-2", sessionId: "c1", content: "嘿嘿", receivedAt: 2 },
      ],
      reply: "第一句。第二句。",
      replyParts: [],
      context: [
        {
          id: "synthetic-user",
          role: "user",
          content: "想你\n嘿嘿",
          created_at: 10,
        },
        {
          id: "synthetic-agent",
          role: "agent",
          content: "第一句。第二句。",
          created_at: 20,
        },
      ],
      replaceSynthetic: true,
    })

    expect(rows.filter((row) => row.role === "user")).toHaveLength(2)
    expect(rows.filter((row) => row.role === "agent")).toHaveLength(0)

    await appendCollectedHistory(env, {
      userId: "u1",
      conversationId: "c1",
      expressionGroupId: "group-2",
      pending: [{ id: "user-3", sessionId: "c1", content: "等等", receivedAt: 3 }],
      replyParts: [{ id: "agent-3", content: "我在", index: 0, total: 1 }],
      context: rows.map((row) => ({
        id: row.id,
        role: row.role,
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        content: row.content,
        created_at: row.created_at,
        expression_group_id: row.expression_group_id,
        expression_part_index: row.expression_part_index,
      })),
    })

    expect(rows.filter((row) => row.expression_group_id === "group-1")).toEqual([
      expect.objectContaining({ id: "user-1", role: "user" }),
      expect.objectContaining({ id: "user-2", role: "user" }),
    ])
    expect(rows.filter((row) => row.expression_group_id === "group-2")).toEqual([
      expect.objectContaining({ id: "user-3", role: "user" }),
      expect.objectContaining({ id: "agent-3", role: "agent" }),
    ])
  })

  it("keeps disconnected replies in database and chat history", async () => {
    const { env, rows } = createMemoryEnv()
    const pending = [
      { id: "user-1", sessionId: "group-1", content: "想你", receivedAt: 1 },
      { id: "user-2", sessionId: "group-1", content: "嘿嘿", receivedAt: 2 },
      { id: "user-3", sessionId: "group-1", content: "睡不着", receivedAt: 3 },
    ]
    const replyParts = withReplySpeakers(
      [
        { id: "agent-1", content: "我在", index: 0, total: 3 },
        { id: "agent-2", content: "先陪你一会儿", index: 1, total: 3 },
        { id: "agent-3", content: "慢慢说", index: 2, total: 3 },
      ],
      [
        { id: "agent:xiaolian", name: "小练" },
        { id: "agent:anan", name: "安安" },
      ],
    )

    await persistVisibleReplyParts(env, {
      userId: "u1",
      conversationId: "group-1",
      expressionGroupId: "group-1",
      syntheticUserMessageId: "group-1:combined",
      pending,
      reply: "我在。先陪你一会儿。慢慢说。",
      replyParts,
      context: [
        {
          id: "group-1:combined",
          role: "user",
          content: "想你\n嘿嘿\n睡不着",
          created_at: 10,
        },
        {
          id: "synthetic-agent",
          role: "agent",
          content: "我在。先陪你一会儿。慢慢说。",
          created_at: 20,
        },
      ],
      replaceSynthetic: true,
    })

    expect(rows.filter((row) => row.role === "user")).toEqual([
      expect.objectContaining({ id: "user-1", content: "想你" }),
      expect.objectContaining({ id: "user-2", content: "嘿嘿" }),
      expect.objectContaining({ id: "user-3", content: "睡不着" }),
    ])
    expect(rows.filter((row) => row.role === "agent")).toEqual([
      expect.objectContaining({
        id: "agent-1",
        content: "我在",
        agent_id: "agent:xiaolian",
        agent_name: "小练",
      }),
      expect.objectContaining({
        id: "agent-2",
        content: "先陪你一会儿",
        agent_id: "agent:anan",
        agent_name: "安安",
      }),
      expect.objectContaining({
        id: "agent-3",
        content: "慢慢说",
        agent_id: "agent:xiaolian",
        agent_name: "小练",
      }),
    ])

    const token = await createAccessToken("u1", env)
    const { chatRoutes } = await import("@/routes/chat")
    const response = await chatRoutes.request(
      new Request("http://localhost/history?limit=20&session_id=group-1", {
        headers: { authorization: `Bearer ${token}` },
      }),
      undefined,
      env,
    )
    const history = (await response.json()) as { messages: ChatMessage[] }
    expect(history.messages.map((message) => message.content)).toEqual([
      "想你",
      "嘿嘿",
      "睡不着",
      "我在",
      "先陪你一会儿",
      "慢慢说",
    ])
    expect(
      history.messages
        .filter((message) => message.role === "agent")
        .map((message) => [message.agent_id, message.agent_name]),
    ).toEqual([
      ["agent:xiaolian", "小练"],
      ["agent:anan", "安安"],
      ["agent:xiaolian", "小练"],
    ])
  })

  it("acknowledges duplicate client messages without reprocessing them", async () => {
    const { env, rows } = createMemoryEnv()
    rows.push({
      id: "m1",
      user_id: "u1",
      conversation_id: "c1",
      role: "user",
      agent_id: null,
      agent_name: null,
      content: "已经收到过",
      created_at: 1,
      expression_group_id: null,
      expression_part_index: null,
      rowid: 1,
    })
    const sent: unknown[] = []
    const socket = {
      send: (value: string) => sent.push(JSON.parse(value)),
    } as unknown as WebSocket

    await expect(
      acknowledgeChatMessage(env, {
        userId: "u1",
        clientMessageId: "m1",
        socket,
      }),
    ).resolves.toBe(true)
    expect(sent).toEqual([
      {
        type: "agent_status",
        status: "received",
        client_message_id: "m1",
      },
    ])
  })

  it("turns reply part tokens into separate mobile bubbles", () => {
    const first = applyTokenMessage(
      [],
      {
        type: "token",
        topic_id: "default",
        delta: "嘿嘿，我也想你了～",
        message_id: "agent-1",
        agent_id: "agent:xiaolian",
        agent_name: "小练",
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
        agent_id: "agent:anan",
        agent_name: "安安",
        expression_group_id: "group-1",
        expression_part_index: 1,
        expression_part_total: 2,
      },
      { id: () => "fallback", now: () => 100 },
    )

    expect(second).toEqual([
      expect.objectContaining({
        id: "agent-2",
        agent_id: "agent:anan",
        agent_name: "安安",
        content: "今天过得开心吗？",
        expression_part_index: 1,
      }),
      expect.objectContaining({
        id: "agent-1",
        agent_id: "agent:xiaolian",
        agent_name: "小练",
        content: "嘿嘿，我也想你了～",
        expression_part_index: 0,
      }),
    ])
  })
})
