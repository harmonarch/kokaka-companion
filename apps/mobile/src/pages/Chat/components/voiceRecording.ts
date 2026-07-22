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
