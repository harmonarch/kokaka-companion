import { describe, expect, it } from "vitest"
import {
  appendCrisisResources,
  CRISIS_RESOURCE_TEXT,
} from "@/agent/crisis"

describe("crisis resources", () => {
  it("appends resources to a normal crisis reply", () => {
    const reply = appendCrisisResources("我会认真陪你撑过这一刻")
    expect(reply).toContain(CRISIS_RESOURCE_TEXT)
  })

  it("does not duplicate when the model names the standalone hotline", () => {
    const reply = appendCrisisResources("请拨打全国统一心理援助热线 12356")
    expect(reply).toBe("请拨打全国统一心理援助热线 12356")
  })

  it("still appends when the reply contains a longer number with 12356 inside", () => {
    const reply = appendCrisisResources("你可以先给 13812356000 打个电话")
    expect(reply).toContain(CRISIS_RESOURCE_TEXT)
  })
})
