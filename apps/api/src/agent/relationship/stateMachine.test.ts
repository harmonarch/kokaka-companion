import { describe, expect, it } from "vitest"
import {
  applyDecay,
  defaultRelationshipState,
  detectRelationshipEvent,
  intimacyLevelFor,
  updateRelationshipState,
} from "@/agent/relationship/stateMachine"

describe("relationship state machine", () => {
  it("uses the expected default state and intimacy levels", () => {
    expect(defaultRelationshipState(1000)).toEqual({
      mood: "calm",
      mood_intensity: 0,
      intimacy: 35,
      intimacy_level: "warm",
      updated_at: 1000,
      last_transition_at: 1000,
      cooldown_until: 0,
    })
    expect(intimacyLevelFor(10)).toBe("polite")
    expect(intimacyLevelFor(35)).toBe("warm")
    expect(intimacyLevelFor(60)).toBe("attached")
    expect(intimacyLevelFor(80)).toBe("deep")
    expect(intimacyLevelFor(95)).toBe("full")
  })

  it("lets intimacy affect shy and jealous transitions", () => {
    const low = updateRelationshipState(
      defaultRelationshipState(1000),
      "想你了",
      2000,
    )
    expect(low.state.mood).toBe("happy")

    const highState = {
      ...defaultRelationshipState(1000),
      intimacy: 75,
      intimacy_level: "deep" as const,
    }
    const shy = updateRelationshipState(highState, "想你了", 2000)
    expect(shy.state.mood).toBe("shy")

    const jealous = updateRelationshipState(
      highState,
      "我今天和小李吃饭了",
      2000,
    )
    expect(jealous.state.mood).toBe("jealous")
  })

  it("lets apologies recover negative moods and raise intimacy", () => {
    const current = {
      ...defaultRelationshipState(1000),
      mood: "angry" as const,
      mood_intensity: 70,
      intimacy: 72,
      intimacy_level: "deep" as const,
      last_transition_at: 1000,
      cooldown_until: 20_000,
    }
    const update = updateRelationshipState(current, "对不起，昨天是我不好", 2000)

    expect(update.state.mood).toBe("angry")
    expect(update.state.mood_intensity).toBeLessThan(current.mood_intensity)
    expect(update.state.intimacy).toBeGreaterThan(current.intimacy)
    expect(update.snapshot).toContain("关系事件：apology")
  })

  it("applies cooldown to ordinary switches", () => {
    const current = {
      ...defaultRelationshipState(1000),
      mood: "happy" as const,
      mood_intensity: 45,
      last_transition_at: 1000,
      cooldown_until: 30_000,
    }
    const update = updateRelationshipState(current, "我今天和小李吃饭了", 2000)
    expect(update.state.mood).toBe("happy")
    expect(update.changed).toBe(false)
  })

  it("decays stale moods back to calm", () => {
    const current = {
      ...defaultRelationshipState(1000),
      mood: "happy" as const,
      mood_intensity: 20,
      last_transition_at: 1000,
      updated_at: 1000,
    }

    expect(applyDecay(current, 1000 + 3 * 60 * 60 * 1000).mood).toBe("calm")
  })

  it("detects relationship events from user text", () => {
    expect(detectRelationshipEvent("对不起，别生气")).toBe("apology")
    expect(detectRelationshipEvent("你怎么又记错了")).toBe("mistake")
    expect(detectRelationshipEvent("今天给你准备了礼物")).toBe("gift")
  })
})
