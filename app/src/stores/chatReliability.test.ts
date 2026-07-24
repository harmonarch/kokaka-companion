import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  removeConfirmedOutgoing,
  clearPendingOutgoing,
  loadPendingOutgoing,
  savePendingOutgoing,
  shouldRecoverConnection,
  toPendingUserMessages,
  upsertPendingOutgoing,
  type PendingOutgoingStorage,
} from "./chatReliability"

function createMemoryStorage(): PendingOutgoingStorage {
  const values = new Map<string, unknown>()
  return {
    loadJson: async <T>(key: string) => (values.get(key) as T) ?? null,
    saveJson: async <T>(key: string, value: T | null) => {
      if (!value) {
        values.delete(key)
        return
      }
      values.set(key, value)
    },
  }
}

describe("chat reliability helpers", () => {
  it("tracks pending outgoing messages until they are confirmed", () => {
    const pending = upsertPendingOutgoing([], {
      id: "m1",
      content: "还在吗",
      conversationId: "c1",
      agents: [],
      createdAt: 1,
    })

    assert.equal(pending.length, 1)
    assert.equal(removeConfirmedOutgoing(pending, "m1").length, 0)
    assert.equal(removeConfirmedOutgoing(pending, undefined), pending)
  })

  it("replaces pending messages with the same id", () => {
    const pending = upsertPendingOutgoing(
      [
        {
          id: "m1",
          content: "旧内容",
          conversationId: "c1",
          agents: [],
          createdAt: 1,
        },
      ],
      {
        id: "m1",
        content: "新内容",
        conversationId: "c1",
        agents: [],
        createdAt: 2,
      },
    )

    assert.deepEqual(
      pending.map((message) => message.content),
      ["新内容"],
    )
  })

  it("recovers only when connection becomes connected", () => {
    assert.equal(shouldRecoverConnection("reconnecting", "connected"), true)
    assert.equal(shouldRecoverConnection("error", "connected"), true)
    assert.equal(shouldRecoverConnection("connecting", "connected"), false)
    assert.equal(shouldRecoverConnection("connected", "connected"), false)
    assert.equal(shouldRecoverConnection("connected", "reconnecting"), false)
  })

  it("persists pending outgoing messages until they are confirmed", async () => {
    const storage = createMemoryStorage()
    const pending = upsertPendingOutgoing([], {
      id: "m1",
      content: "别丢",
      conversationId: "c1",
      agents: [],
      createdAt: 1,
    })

    await savePendingOutgoing(storage, pending)
    assert.deepEqual(await loadPendingOutgoing(storage), pending)

    const confirmed = removeConfirmedOutgoing(pending, "m1")
    await savePendingOutgoing(storage, confirmed)
    assert.deepEqual(await loadPendingOutgoing(storage), [])
  })

  it("restores pending messages as user chat messages", () => {
    assert.deepEqual(
      toPendingUserMessages(
        [
          {
            id: "m1",
            content: "回来",
            conversationId: "c1",
            agents: [],
            createdAt: 123,
          },
          {
            id: "m2",
            content: "别的会话",
            conversationId: "c2",
            agents: [],
            createdAt: 124,
          },
        ],
        "c1",
      ),
      [{ id: "m1", role: "user", content: "回来", created_at: 123 }],
    )
  })

  it("keeps the trace id when restoring a pending message", () => {
    assert.deepEqual(
      toPendingUserMessages([
        {
          id: "m1",
          content: "回来",
          conversationId: "c1",
          agents: [],
          createdAt: 123,
          traceId: "trace-1",
        },
      ]),
      [
        {
          id: "m1",
          role: "user",
          content: "回来",
          created_at: 123,
          trace_id: "trace-1",
        },
      ],
    )
  })

  it("exposes pending message ids as retry targets", () => {
    const pending = upsertPendingOutgoing([], {
      id: "m1",
      content: "重试这条",
      conversationId: "c1",
      agents: [],
      createdAt: 1,
    })

    assert.deepEqual(
      pending.map((message) => message.id),
      ["m1"],
    )
  })

  it("clears pending outgoing messages on account exit", async () => {
    const storage = createMemoryStorage()
    await savePendingOutgoing(storage, [
      {
        id: "m1",
        content: "旧用户消息",
        conversationId: "c1",
        agents: [],
        createdAt: 1,
      },
    ])

    await clearPendingOutgoing(storage)

    assert.deepEqual(await loadPendingOutgoing(storage), [])
  })
})
