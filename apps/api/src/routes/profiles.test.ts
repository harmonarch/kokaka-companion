import { describe, expect, it, vi } from "vitest"
import { profileRoutes } from "@/routes/profiles"
import type { Env } from "@/env"

vi.mock("@/auth/session", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    id: "u1",
    email: "u1@example.com",
    nickname: "小林",
  }),
}))

function createEnvFixture() {
  const profiles = new Map<
    string,
    {
      user_id: string
      role: "user" | "agent"
      nickname: string | null
      avatar_url: string | null
      updated_at: number
    }
  >()

  const db = {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          this.args = args
          return this
        },
        async run() {
          if (sql.includes("INSERT INTO chat_profiles")) {
            const [userId, role, nickname, avatarUrl, updatedAt] = this.args as [
              string,
              "user" | "agent",
              string | null,
              string | null,
              number,
            ]
            profiles.set(`${userId}:${role}`, {
              user_id: userId,
              role,
              nickname,
              avatar_url: avatarUrl,
              updated_at: updatedAt,
            })
          }
          return { success: true }
        },
        async all() {
          const [userId] = this.args as [string]
          return {
            results: [...profiles.values()].filter(
              (profile) => profile.user_id === userId,
            ),
          }
        },
      }
      return statement
    },
  }

  return {
    env: { DB: db } as unknown as Env,
    profiles,
  }
}

describe("profile routes", () => {
  it("stores user and agent chat profiles independently", async () => {
    const { env } = createEnvFixture()
    const avatar = "data:image/png;base64,aaaa"

    const updateResponse = await profileRoutes.request(
      new Request("http://localhost/chat", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          user: {
            nickname: "我",
            avatar_url: avatar,
          },
          agent: {
            nickname: "Kokaka",
            avatar_url: null,
          },
        }),
      }),
      undefined,
      env,
    )

    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toEqual({
      user: {
        nickname: "我",
        avatar_url: avatar,
      },
      agent: {
        nickname: "Kokaka",
        avatar_url: null,
      },
    })

    const getResponse = await profileRoutes.request(
      new Request("http://localhost/chat", {
        headers: { authorization: "Bearer token" },
      }),
      undefined,
      env,
    )

    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toEqual({
      user: {
        nickname: "我",
        avatar_url: avatar,
      },
      agent: {
        nickname: "Kokaka",
        avatar_url: null,
      },
    })
  })
})
