import { describe, expect, it } from "vitest"
import {
  chatMessageSchema,
  clientWsMessageSchema,
  serverWsMessageSchema,
} from "@ai-companion/shared"

describe("chat websocket schemas", () => {
  const relationshipState = {
    mood: "calm",
    mood_intensity: 0,
    intimacy: 35,
    intimacy_level: "warm",
    updated_at: 1,
    last_transition_at: 1,
    cooldown_until: 0,
  } as const

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

  it("accepts reply part metadata on token messages", () => {
    expect(
      serverWsMessageSchema.parse({
        type: "token",
        topic_id: "default",
        delta: "嘿嘿，我也想你了～",
        message_id: "agent-part-1",
        expression_group_id: "group-1",
        expression_part_index: 0,
        expression_part_total: 2,
      }),
    ).toEqual({
      type: "token",
      topic_id: "default",
      delta: "嘿嘿，我也想你了～",
      message_id: "agent-part-1",
      expression_group_id: "group-1",
      expression_part_index: 0,
      expression_part_total: 2,
    })
  })

  it("accepts agent status server messages", () => {
    expect(
      serverWsMessageSchema.parse({
        type: "agent_status",
        status: "received",
      }),
    ).toEqual({
      type: "agent_status",
      status: "received",
    })
    expect(
      serverWsMessageSchema.parse({
        type: "agent_status",
        status: "listening",
      }),
    ).toEqual({
      type: "agent_status",
      status: "listening",
    })
    expect(
      serverWsMessageSchema.parse({
        type: "agent_status",
        status: "replying",
      }),
    ).toEqual({
      type: "agent_status",
      status: "replying",
    })
  })

  it("accepts relationship state on all done messages", () => {
    expect(
      serverWsMessageSchema.parse({
        type: "all_done",
        metadata: {
          emotion_state: "normal",
          relationship_state: relationshipState,
          topics_count: 1,
        },
      }),
    ).toEqual({
      type: "all_done",
      metadata: {
        emotion_state: "normal",
        relationship_state: relationshipState,
        topics_count: 1,
      },
    })
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
