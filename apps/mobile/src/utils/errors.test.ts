import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  authCredentialsErrorMessage,
  getAuthCredentialsError,
  getNetworkErrorMessage,
  getReadableErrorMessage,
  networkErrorMessage,
} from "./errors"

describe("readable error messages", () => {
  it("hides raw network errors", () => {
    assert.equal(
      getReadableErrorMessage(new Error("Failed to fetch"), "操作失败"),
      null,
    )
    assert.equal(
      getReadableErrorMessage(
        new Error("Network request failed"),
        "操作失败",
      ),
      null,
    )
    assert.equal(
      getNetworkErrorMessage(new Error("Failed to fetch")),
      networkErrorMessage,
    )
  })

  it("keeps clear server messages", () => {
    assert.equal(
      getReadableErrorMessage(new Error("邮箱已经被注册"), "操作失败"),
      "邮箱已经被注册",
    )
  })

  it("uses page fallback for vague request failures", () => {
    assert.equal(
      getReadableErrorMessage(new Error("Request failed"), "聊天列表载入失败"),
      "聊天列表载入失败",
    )
  })

  it("shows service unavailable separately", () => {
    const error = Object.assign(new Error("Request failed"), { status: 503 })
    assert.equal(
      getReadableErrorMessage(error, "聊天列表载入失败"),
      "服务暂时不可用，请稍后再试。",
    )
  })

  it("maps login 401 to credentials error instead of session expiry", () => {
    const error = Object.assign(new Error("Invalid email or password"), {
      status: 401,
    })
    assert.equal(getAuthCredentialsError(error), authCredentialsErrorMessage)
    assert.equal(getAuthCredentialsError(new Error("Request failed")), null)
  })
})
