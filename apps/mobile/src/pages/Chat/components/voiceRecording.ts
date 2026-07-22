export const minimumVoiceRecordingDurationMs = 300
export const maximumVoiceRecordingDurationMs = 60_000
export const maximumVoiceRecordingSizeBytes = 10 * 1024 * 1024

export type VoiceRecordingValidationError =
  | "too_short"
  | "empty"
  | "too_large"
  | "unsupported_type"

export type VoiceRecordingValidation =
  | { valid: true }
  | { valid: false; error: VoiceRecordingValidationError }

export function normalizeVoiceRecordingMimeType(mimeType: string) {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

export function isSupportedVoiceRecordingMimeType(mimeType: string) {
  const normalized = normalizeVoiceRecordingMimeType(mimeType)
  return normalized === "audio/webm" || normalized === "audio/mp4"
}

export function validateVoiceRecording({
  durationMs,
  sizeBytes,
  mimeType,
}: {
  durationMs: number
  sizeBytes: number
  mimeType: string
}): VoiceRecordingValidation {
  if (durationMs < minimumVoiceRecordingDurationMs) {
    return { valid: false, error: "too_short" }
  }
  if (sizeBytes <= 0) return { valid: false, error: "empty" }
  if (sizeBytes > maximumVoiceRecordingSizeBytes) {
    return { valid: false, error: "too_large" }
  }
  if (!isSupportedVoiceRecordingMimeType(mimeType)) {
    return { valid: false, error: "unsupported_type" }
  }
  return { valid: true }
}

export function mergeVoiceTranscription(draft: string, transcription: string) {
  const normalizedTranscription = transcription.trim()
  if (!normalizedTranscription) return draft
  if (!draft) return normalizedTranscription
  if (/\s$/.test(draft)) return `${draft}${normalizedTranscription}`
  return `${draft} ${normalizedTranscription}`
}

export function removeSubmittedDraft(
  currentDraft: string,
  submittedDraft: string,
) {
  if (currentDraft === submittedDraft) return ""
  if (currentDraft.startsWith(submittedDraft)) {
    return currentDraft.slice(submittedDraft.length).trimStart()
  }
  return currentDraft
}

export function getVoiceTranscriptionClientErrorMessage(status: number) {
  switch (status) {
    case 400:
      return "没有录到声音"
    case 401:
      return "登录已过期，请重新登录"
    case 403:
      return "没有权限使用语音输入"
    case 413:
      return "录音太大，请缩短录音时间"
    case 415:
      return "此浏览器的录音格式不受支持"
    case 422:
      return "没有识别到语音"
    case 429:
      return null
    default:
      return status >= 400 && status < 500 ? "无法转写这段录音" : null
  }
}
