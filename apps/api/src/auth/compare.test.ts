import { describe, expect, it } from "vitest"
import { timingSafeEquals } from "@/auth/compare"

describe("timingSafeEquals", () => {
  it("matches identical strings", () => {
    expect(timingSafeEquals("abc.123", "abc.123")).toBe(true)
    expect(timingSafeEquals("", "")).toBe(true)
  })

  it("rejects strings that differ in content or length", () => {
    expect(timingSafeEquals("abc.123", "abc.124")).toBe(false)
    expect(timingSafeEquals("abc.123", "abc.12")).toBe(false)
    expect(timingSafeEquals("abc", "")).toBe(false)
  })
})
