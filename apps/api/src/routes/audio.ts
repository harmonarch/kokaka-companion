import { audioTranscriptionResponseSchema } from "@ai-companion/shared"
import { Hono } from "hono"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"

export const audioRoutes = new Hono<AppBindings>()

audioRoutes.use("*", authMiddleware)

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const SUPPORTED_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4"])
const TRANSCRIPTION_MODEL = "@cf/openai/whisper-large-v3-turbo" as const

type ReadAudioResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "empty" | "too_large"; sizeBytes: number }

function mediaType(contentType: string | undefined) {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

async function readAudioBody(
  request: Request,
  maxBytes: number,
): Promise<ReadAudioResult> {
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, reason: "too_large", sizeBytes: contentLength }
  }

  const reader = request.body?.getReader()
  if (!reader) return { ok: false, reason: "empty", sizeBytes: 0 }

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value.byteLength) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel()
      } catch {
        // The response is already determined by the bytes received.
      }
      return { ok: false, reason: "too_large", sizeBytes: totalBytes }
    }
    chunks.push(value)
  }

  if (totalBytes === 0) {
    return { ok: false, reason: "empty", sizeBytes: 0 }
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, bytes }
}

function toBase64(bytes: Uint8Array) {
  const chunkSize = 32 * 1024
  const parts: string[] = []
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    let binary = ""
    for (const byte of chunk) binary += String.fromCharCode(byte)
    parts.push(binary)
  }
  return btoa(parts.join(""))
}

function logTranscription(input: {
  traceId: string
  durationMs: number
  sizeBytes: number
  format: string
  status:
    | "success"
    | "empty"
    | "unsupported"
    | "too_large"
    | "no_speech"
    | "error"
  error?: string
}) {
  console.info(
    JSON.stringify({
      event: "audio_transcription",
      trace_id: input.traceId,
      duration_ms: input.durationMs,
      size_bytes: input.sizeBytes,
      format: input.format,
      status: input.status,
      error: input.error,
    }),
  )
}

audioRoutes.post("/transcriptions", async (c) => {
  const startedAt = Date.now()
  const traceId = c.get("traceId") ?? ""
  const format = mediaType(c.req.header("content-type"))
  const contentLength = Number(c.req.header("content-length"))
  const declaredSize = Number.isFinite(contentLength) ? contentLength : 0

  if (!SUPPORTED_AUDIO_TYPES.has(format)) {
    logTranscription({
      traceId,
      durationMs: Date.now() - startedAt,
      sizeBytes: declaredSize,
      format,
      status: "unsupported",
    })
    return c.json({ error: "Unsupported audio format" }, 415)
  }

  const audio = await readAudioBody(c.req.raw, MAX_AUDIO_BYTES)
  if (!audio.ok) {
    logTranscription({
      traceId,
      durationMs: Date.now() - startedAt,
      sizeBytes: audio.sizeBytes,
      format,
      status: audio.reason,
    })
    return audio.reason === "too_large"
      ? c.json({ error: "Audio is too large" }, 413)
      : c.json({ error: "Audio is empty" }, 400)
  }

  try {
    const result = await c.env.AI.run(TRANSCRIPTION_MODEL, {
      audio: toBase64(audio.bytes),
      vad_filter: true,
    })
    const text = result.text.trim()
    if (!text) {
      logTranscription({
        traceId,
        durationMs: Date.now() - startedAt,
        sizeBytes: audio.bytes.byteLength,
        format,
        status: "no_speech",
      })
      return c.json({ error: "No speech detected" }, 422)
    }

    logTranscription({
      traceId,
      durationMs: Date.now() - startedAt,
      sizeBytes: audio.bytes.byteLength,
      format,
      status: "success",
    })
    return c.json(audioTranscriptionResponseSchema.parse({ text }))
  } catch (error) {
    console.error("audio transcription failed", error)
    logTranscription({
      traceId,
      durationMs: Date.now() - startedAt,
      sizeBytes: audio.bytes.byteLength,
      format,
      status: "error",
      error: "model_failure",
    })
    return c.json({ error: "Audio transcription failed" }, 502)
  }
})
