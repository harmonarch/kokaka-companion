import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isSameSession,
  shouldLoadForSession,
  shouldLoadForUser,
  shouldResetSession,
} from "./requestCache"

describe("request cache guards", () => {
  it("does not load the same user again after data is loaded", () => {
    assert.equal(
      shouldLoadForUser(
        { loaded: true, loading: false, userId: "user:1" },
        "user:1",
      ),
      false,
    )
  })

  it("does not start a duplicate request while the same user is loading", () => {
    assert.equal(
      shouldLoadForUser(
        { loaded: false, loading: true, userId: "user:1" },
        "user:1",
      ),
      false,
    )
  })

  it("loads again when the active user changes", () => {
    assert.equal(
      shouldLoadForUser(
        { loaded: true, loading: false, userId: "user:1" },
        "user:2",
      ),
      true,
    )
  })

  it("does not load the same chat session again after history is loaded", () => {
    assert.equal(
      shouldLoadForSession(
        {
          loaded: true,
          loading: false,
          userId: "user:1",
          sessionId: "chat:1",
        },
        "user:1",
        "chat:1",
      ),
      false,
    )
  })

  it("loads again when the active chat session changes", () => {
    assert.equal(
      shouldLoadForSession(
        {
          loaded: true,
          loading: false,
          userId: "user:1",
          sessionId: "chat:1",
        },
        "user:1",
        "chat:2",
      ),
      true,
    )
    assert.equal(
      shouldResetSession(
        {
          loaded: true,
          loading: false,
          userId: "user:1",
          sessionId: "chat:1",
        },
        "user:1",
        "chat:2",
      ),
      true,
    )
  })

  it("matches only the active user and session", () => {
    assert.equal(
      isSameSession(
        {
          loaded: false,
          loading: true,
          userId: "user:1",
          sessionId: "chat:1",
        },
        "user:1",
        "chat:1",
      ),
      true,
    )
    assert.equal(
      isSameSession(
        {
          loaded: false,
          loading: true,
          userId: "user:1",
          sessionId: "chat:1",
        },
        "user:2",
        "chat:1",
      ),
      false,
    )
  })
})
