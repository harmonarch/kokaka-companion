import { describe, expect, it } from "vitest"
import { authRoutes } from "@/routes/auth"
import { hashOpaqueToken } from "@/auth/password"
import type { Env } from "@/env"

type RefreshRecord = {
  id: string
  user_id: string
  expires_at: number
  revoked_at: number | null
}

function createEnvFixture(options: {
  record: RefreshRecord | null
  user: { id: string; email: string; nickname: string | null } | null
}) {
  const now = Math.floor(Date.now() / 1000)
  const familyRevokes: Array<{ userId: string; revokedAt: number }> = []
  const rotations: Array<{ id: string; revokedAt: number }> = []
  const insertedTokens: string[] = []
  let tokenHash: string | null = null

  const db = {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          this.args = args
          if (sql.includes("FROM refresh_tokens WHERE token_hash")) {
            tokenHash = args[0] as string
          }
          return this
        },
        async first() {
          if (sql.includes("FROM refresh_tokens WHERE token_hash")) {
            if (!options.record || tokenHash === null) return null
            const hashed = await hashOpaqueToken(
              "valid-refresh-token",
              { JWT_SECRET: "test-secret" } as Env,
            )
            return tokenHash === hashed ? options.record : null
          }
          if (sql.includes("FROM users")) {
            return options.user
          }
          return null
        },
        async run() {
          if (sql.includes("WHERE user_id = ? AND revoked_at IS NULL")) {
            const [revokedAt, userId] = this.args as [number, string]
            familyRevokes.push({ revokedAt, userId })
          }
          if (sql.startsWith("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?")) {
            const [revokedAt, id] = this.args as [number, string]
            rotations.push({ revokedAt, id })
          }
          if (sql.startsWith("INSERT INTO refresh_tokens")) {
            insertedTokens.push(String(this.args[2]))
          }
          return { success: true }
        },
      }
      return statement
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) {
        await statement.run()
      }
    },
  }

  const env = {
    DB: db,
    JWT_SECRET: "test-secret",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    REFRESH_TOKEN_TTL_SECONDS: "2592000",
    PASSWORD_HASH_SECRET: "test-pepper",
  } as unknown as Env

  return { env, now, familyRevokes, rotations, insertedTokens }
}

describe("auth routes", () => {
  it("rotates a valid refresh token and revokes the old record", async () => {
    const now = Math.floor(Date.now() / 1000)
    const { env, familyRevokes, rotations, insertedTokens } = createEnvFixture({
      record: {
        id: "r1",
        user_id: "u1",
        expires_at: now + 1000,
        revoked_at: null,
      },
      user: { id: "u1", email: "u1@example.com", nickname: "小林" },
    })

    const response = await authRoutes.request(
      new Request("http://localhost/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: "valid-refresh-token" }),
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { tokens: { access_token: string } }
    expect(payload.tokens.access_token.split(".")).toHaveLength(3)
    expect(familyRevokes).toEqual([])
    expect(rotations).toEqual([{ revokedAt: expect.any(Number), id: "r1" }])
    expect(insertedTokens).toHaveLength(1)
  })

  it("revokes the whole family when an already-rotated token is replayed", async () => {
    const now = Math.floor(Date.now() / 1000)
    const { env, familyRevokes, rotations, insertedTokens } = createEnvFixture({
      record: {
        id: "r1",
        user_id: "u1",
        expires_at: now + 1000,
        revoked_at: now - 10,
      },
      user: { id: "u1", email: "u1@example.com", nickname: "小林" },
    })

    const response = await authRoutes.request(
      new Request("http://localhost/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: "valid-refresh-token" }),
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(401)
    expect(familyRevokes).toEqual([
      { userId: "u1", revokedAt: expect.any(Number) },
    ])
    expect(rotations).toEqual([])
    expect(insertedTokens).toEqual([])
  })

  it("rejects an unknown refresh token without touching stored tokens", async () => {
    const now = Math.floor(Date.now() / 1000)
    const { env, familyRevokes, rotations, insertedTokens } = createEnvFixture({
      record: {
        id: "r1",
        user_id: "u1",
        expires_at: now + 1000,
        revoked_at: null,
      },
      user: { id: "u1", email: "u1@example.com", nickname: "小林" },
    })

    const response = await authRoutes.request(
      new Request("http://localhost/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: "unknown-token" }),
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(401)
    expect(familyRevokes).toEqual([])
    expect(rotations).toEqual([])
    expect(insertedTokens).toEqual([])
  })
})
