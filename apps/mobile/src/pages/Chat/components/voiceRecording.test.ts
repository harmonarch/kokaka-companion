import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  maximumVoiceRecordingSizeBytes,
  validateVoiceRecording,
} from "./voiceRecording"

const validRecording = {
  durationMs: 300,
  sizeBytes: 1024,
  mimeType: "audio/webm;codecs=opus",
}

describe("voice recording validation", () => {
  it("rejects recordings shorter than 300 milliseconds", () => {
    for (const durationMs of [100, 299]) {
      assert.deepEqual(
        validateVoiceRecording({ ...validRecording, durationMs }),
        {
          valid: false,
          error: "too_short",
        },
      )
    }
  })

  it("accepts recordings at and above 300 milliseconds", () => {
    for (const durationMs of [300, 301]) {
      assert.deepEqual(
        validateVoiceRecording({ ...validRecording, durationMs }),
        {
          valid: true,
        },
      )
    }
  })

  it("rejects empty, oversized, and unsupported recordings", () => {
    assert.deepEqual(
      validateVoiceRecording({ ...validRecording, sizeBytes: 0 }),
      { valid: false, error: "empty" },
    )
    assert.deepEqual(
      validateVoiceRecording({
        ...validRecording,
        sizeBytes: maximumVoiceRecordingSizeBytes + 1,
      }),
      { valid: false, error: "too_large" },
    )
    assert.deepEqual(
      validateVoiceRecording({ ...validRecording, mimeType: "audio/ogg" }),
      { valid: false, error: "unsupported_type" },
    )
    assert.equal(
      validateVoiceRecording({
        ...validRecording,
        sizeBytes: maximumVoiceRecordingSizeBytes,
      }).valid,
      true,
    )
  })

  it("accepts WebM and MP4 MIME parameters", () => {
    assert.equal(
      validateVoiceRecording({
        ...validRecording,
        mimeType: "audio/mp4; codecs=mp4a.40.2",
      }).valid,
      true,
    )
  })
})
