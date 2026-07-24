import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  maximumVoiceRecordingSizeBytes,
  getVoiceTranscriptionClientErrorMessage,
  mergeVoiceTranscription,
  removeSubmittedDraft,
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

describe("voice transcription draft merging", () => {
  it("appends to the latest draft without overwriting it", () => {
    assert.equal(
      mergeVoiceTranscription("刚刚输入的内容", "转写内容"),
      "刚刚输入的内容 转写内容",
    )
    assert.equal(
      mergeVoiceTranscription("刚刚输入的内容 ", " 转写内容 "),
      "刚刚输入的内容 转写内容",
    )
    assert.equal(mergeVoiceTranscription("", " 转写内容 "), "转写内容")
  })

  it("ignores an empty transcription", () => {
    assert.equal(mergeVoiceTranscription("保留草稿", "  "), "保留草稿")
  })

  it("keeps a transcription that arrives while an earlier draft is sending", () => {
    const submittedDraft = "已经发送"
    const latestDraft = mergeVoiceTranscription(submittedDraft, "稍后转写")
    assert.equal(removeSubmittedDraft(latestDraft, submittedDraft), "稍后转写")
  })
})

describe("voice transcription errors", () => {
  it("provides specific messages for recordings rejected by the server", () => {
    assert.equal(getVoiceTranscriptionClientErrorMessage(400), "没有录到声音")
    assert.equal(
      getVoiceTranscriptionClientErrorMessage(413),
      "录音太大，请缩短录音时间",
    )
    assert.equal(
      getVoiceTranscriptionClientErrorMessage(415),
      "此浏览器的录音格式不受支持",
    )
    assert.equal(getVoiceTranscriptionClientErrorMessage(422), "没有识别到语音")
  })

  it("keeps server and network failures eligible for retry", () => {
    assert.equal(getVoiceTranscriptionClientErrorMessage(429), null)
    assert.equal(getVoiceTranscriptionClientErrorMessage(500), null)
    assert.equal(getVoiceTranscriptionClientErrorMessage(502), null)
  })
})
