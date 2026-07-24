import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getAuthFieldsError, missingAuthFieldsMessage } from "./authValidation"

describe("auth field validation", () => {
  it("requires email and password before submit", () => {
    assert.equal(getAuthFieldsError("", ""), missingAuthFieldsMessage)
    assert.equal(
      getAuthFieldsError("user@example.com", ""),
      missingAuthFieldsMessage,
    )
    assert.equal(getAuthFieldsError("", "password"), missingAuthFieldsMessage)
    assert.equal(getAuthFieldsError("user@example.com", "password"), null)
  })
})
