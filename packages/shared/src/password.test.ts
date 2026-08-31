import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hashClientPassword } from "./password.js"

describe("hashClientPassword", () => {
  it("returns a 64-char lowercase hex digest", () => {
    assert.match(hashClientPassword("hello"), /^[0-9a-f]{64}$/)
  })

  it("is deterministic for the same input", () => {
    assert.equal(hashClientPassword("s3cret!"), hashClientPassword("s3cret!"))
  })

  it("differs for different inputs", () => {
    assert.notEqual(hashClientPassword("abc"), hashClientPassword("abd"))
  })
})
