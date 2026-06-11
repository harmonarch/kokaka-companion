import { describe, expect, it } from "vitest"
import {
  chatMessageSchema,
  clientWsMessageSchema,
  serverWsMessageSchema,
} from "@ai-companion/shared"

describe("chat websocket schemas", () => {
  it("accepts done client messages", () => {
    expect(clientWsMessageSchema.parse({ type: "done" })).toEqual({
      type: "done",
    })
  })

  it("accepts nudge and gentle server messages", () => {
    expect(
      serverWsMessageSchema.parse({ type: "nudge", content: "嗯，我在听" }),
    ).toEqual({ type: "nudge", content: "嗯，我在听" })
    expect(
      serverWsMessageSchema.parse({ type: "gentle", content: "慢慢说" }),
    ).toEqual({ type: "gentle", content: "慢慢说" })
  })

  it("accepts expression group metadata on chat messages", () => {
    expect(
      chatMessageSchema.parse({
        id: "m1",
        role: "user",
        content: "我今天有点烦",
        created_at: 1,
        expression_group_id: "group-1",
        expression_part_index: 0,
      }),
    ).toMatchObject({
      expression_group_id: "group-1",
      expression_part_index: 0,
    })
  })
})
