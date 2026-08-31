import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getAuthFieldsError,
  missingAuthFieldsMessage,
  passwordTooShortMessage,
} from "./authValidation"

describe("auth field validation", () => {
  it("requires email and password before submit", () => {
    assert.equal(getAuthFieldsError("", "", "login"), missingAuthFieldsMessage)
    assert.equal(
      getAuthFieldsError("user@example.com", "", "register"),
      missingAuthFieldsMessage,
    )
    assert.equal(
      getAuthFieldsError("", "password", "login"),
      missingAuthFieldsMessage,
    )
    assert.equal(
      getAuthFieldsError("user@example.com", "password", "login"),
      null,
    )
  })

  it("rejects short passwords on register only", () => {
    assert.equal(
      getAuthFieldsError("user@example.com", "123456", "register"),
      passwordTooShortMessage,
    )
    assert.equal(
      getAuthFieldsError("user@example.com", "123456", "login"),
      null,
    )
    assert.equal(
      getAuthFieldsError("user@example.com", "12345678", "register"),
      null,
    )
  })
})
