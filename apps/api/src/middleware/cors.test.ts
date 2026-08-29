import { describe, expect, it } from "vitest"
import {
  resolveAllowedOrigins,
  resolveCorsOrigin,
} from "@/middleware/cors"

describe("resolveAllowedOrigins", () => {
  it("parses a comma separated list", () => {
    expect(
      resolveAllowedOrigins("https://a.example.com, https://b.example.com"),
    ).toEqual(["https://a.example.com", "https://b.example.com"])
  })

  it("treats unset or blank values as no allowlist", () => {
    expect(resolveAllowedOrigins(undefined)).toBeNull()
    expect(resolveAllowedOrigins("")).toBeNull()
    expect(resolveAllowedOrigins(" , ")).toBeNull()
  })
})

describe("resolveCorsOrigin", () => {
  it("echoes any origin when no allowlist is configured", () => {
    const allowed = resolveAllowedOrigins(undefined)
    expect(resolveCorsOrigin(allowed, "https://any.example.com")).toBe(
      "https://any.example.com",
    )
    expect(resolveCorsOrigin(allowed, "")).toBe("*")
  })

  it("only echoes allowlisted origins when configured", () => {
    const allowed = resolveAllowedOrigins("https://a.example.com")
    expect(resolveCorsOrigin(allowed, "https://a.example.com")).toBe(
      "https://a.example.com",
    )
    expect(resolveCorsOrigin(allowed, "https://b.example.com")).toBeNull()
    expect(resolveCorsOrigin(allowed, "")).toBeNull()
  })
})
