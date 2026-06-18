import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  removeConfirmedOutgoing,
  shouldRecoverConnection,
  upsertPendingOutgoing,
} from "./chatReliability"

describe("chat reliability helpers", () => {
  it("tracks pending outgoing messages until they are confirmed", () => {
    const pending = upsertPendingOutgoing([], {
      id: "m1",
      content: "还在吗",
      conversationId: "c1",
      agents: [],
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
        },
      ],
      {
        id: "m1",
        content: "新内容",
        conversationId: "c1",
        agents: [],
      },
    )

    assert.deepEqual(pending.map((message) => message.content), ["新内容"])
  })

  it("recovers only when connection becomes connected", () => {
    assert.equal(shouldRecoverConnection("reconnecting", "connected"), true)
    assert.equal(shouldRecoverConnection("error", "connected"), true)
    assert.equal(shouldRecoverConnection("connecting", "connected"), false)
    assert.equal(shouldRecoverConnection("connected", "connected"), false)
    assert.equal(shouldRecoverConnection("connected", "reconnecting"), false)
  })
})
