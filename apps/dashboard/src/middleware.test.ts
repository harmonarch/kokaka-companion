import { afterEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "./middleware"

const originalUser = process.env.DASHBOARD_ACCESS_USER
const originalPassword = process.env.DASHBOARD_ACCESS_PASSWORD

afterEach(() => {
  if (originalUser === undefined) delete process.env.DASHBOARD_ACCESS_USER
  else process.env.DASHBOARD_ACCESS_USER = originalUser
  if (originalPassword === undefined)
    delete process.env.DASHBOARD_ACCESS_PASSWORD
  else process.env.DASHBOARD_ACCESS_PASSWORD = originalPassword
})

describe("dashboard access middleware", () => {
  it("fails closed when access credentials are missing", () => {
    delete process.env.DASHBOARD_ACCESS_USER
    delete process.env.DASHBOARD_ACCESS_PASSWORD

    const response = middleware(new NextRequest("https://dashboard.test"))

    expect(response.status).toBe(503)
  })

  it("requests authentication for invalid credentials", () => {
    process.env.DASHBOARD_ACCESS_USER = "admin"
    process.env.DASHBOARD_ACCESS_PASSWORD = "correct-password"
    const request = new NextRequest("https://dashboard.test", {
      headers: { authorization: `Basic ${btoa("admin:wrong-password")}` },
    })

    const response = middleware(request)

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain("Basic")
  })

  it("allows matching credentials", () => {
    process.env.DASHBOARD_ACCESS_USER = "admin"
    process.env.DASHBOARD_ACCESS_PASSWORD = "correct-password"
    const request = new NextRequest("https://dashboard.test", {
      headers: {
        authorization: `Basic ${btoa("admin:correct-password")}`,
      },
    })

    const response = middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})
