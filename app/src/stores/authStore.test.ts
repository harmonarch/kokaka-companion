import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getUserAfterRefreshError,
  shouldClearSessionAfterRefreshError,
  type SessionUser,
} from "./authSession"

function createAccessToken(userId: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  )
  const body = Buffer.from(JSON.stringify({ sub: userId })).toString(
    "base64url",
  )
  return `${header}.${body}.signature`
}

describe("auth session refresh", () => {
  it("clears only when the backend confirms auth is invalid", () => {
    assert.equal(shouldClearSessionAfterRefreshError({ status: 401 }), true)
    assert.equal(
      shouldClearSessionAfterRefreshError(new Error("Failed to fetch")),
      false,
    )
    assert.equal(shouldClearSessionAfterRefreshError({ status: 503 }), false)
  })

  it("keeps a cached user through backend outages", () => {
    const cachedUser: SessionUser = {
      id: "user-1",
      email: "user@example.com",
      nickname: "小可",
    }

    assert.deepEqual(
      getUserAfterRefreshError(new Error("Failed to fetch"), cachedUser, null),
      cachedUser,
    )
  })

  it("uses the access token user id when no cached user exists", () => {
    assert.deepEqual(
      getUserAfterRefreshError(new Error("Failed to fetch"), null, {
        access_token: createAccessToken("user-2"),
      }),
      {
        id: "user-2",
        email: "user-2@local.invalid",
        nickname: null,
      },
    )
  })

  it("does not keep a user after a confirmed 401", () => {
    assert.equal(
      getUserAfterRefreshError({ status: 401 }, null, {
        access_token: createAccessToken("user-2"),
      }),
      null,
    )
  })
})
