import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "@/env"

const { authenticateRequestMock } = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
}))

vi.mock("@/auth/session", () => ({
  authenticateRequest: authenticateRequestMock,
}))

import { audioRoutes } from "@/routes/audio"

function createFixture(output: { text: string } = { text: "你好" }) {
  const run = vi.fn().mockResolvedValue(output)
  const env = { AI: { run } } as unknown as Env
  return { env, run }
}

function request(
  body: BodyInit | null,
  contentType = "audio/webm",
  headers?: HeadersInit,
) {
  return new Request("http://localhost/transcriptions", {
    method: "POST",
    headers: {
      authorization: "Bearer token",
      "content-type": contentType,
      ...headers,
    },
    body,
  })
}

describe("audio transcription routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authenticateRequestMock.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      nickname: "小林",
    })
  })

  it("requires authentication before reading or transcribing audio", async () => {
    authenticateRequestMock.mockResolvedValueOnce(null)
    const { env, run } = createFixture()

    const response = await audioRoutes.request(
      request(new Uint8Array([1, 2, 3])),
      undefined,
      env,
    )

    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it.each(["audio/webm;codecs=opus", "audio/mp4; codecs=mp4a.40.2"])(
    "transcribes supported %s audio",
    async (contentType) => {
      const { env, run } = createFixture({ text: "  你好，世界  " })

      const response = await audioRoutes.request(
        request(new Uint8Array([0, 1, 2, 255]), contentType),
        undefined,
        env,
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ text: "你好，世界" })
      expect(run).toHaveBeenCalledWith("@cf/openai/whisper-large-v3-turbo", {
        audio: "AAEC/w==",
        vad_filter: true,
      })
      expect(run.mock.calls[0]?.[1]).not.toHaveProperty("language")
    },
  )

  it("rejects unsupported audio without reading it", async () => {
    const { env, run } = createFixture()

    const response = await audioRoutes.request(
      request(new Uint8Array([1]), "audio/ogg"),
      undefined,
      env,
    )

    expect(response.status).toBe(415)
    expect(await response.json()).toEqual({
      error: "Unsupported audio format",
    })
    expect(run).not.toHaveBeenCalled()
  })

  it("rejects an empty body", async () => {
    const { env, run } = createFixture()

    const response = await audioRoutes.request(request(null), undefined, env)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Audio is empty" })
    expect(run).not.toHaveBeenCalled()
  })

  it("rejects a declared body larger than 10 MiB", async () => {
    const { env, run } = createFixture()

    const response = await audioRoutes.request(
      request(new Uint8Array([1]), "audio/webm", {
        "content-length": String(10 * 1024 * 1024 + 1),
      }),
      undefined,
      env,
    )

    expect(response.status).toBe(413)
    expect(run).not.toHaveBeenCalled()
  })

  it("stops reading a streamed body as soon as it exceeds 10 MiB", async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6 * 1024 * 1024))
        controller.enqueue(new Uint8Array(5 * 1024 * 1024))
      },
      cancel,
    })
    const streamedRequest = new Request("http://localhost/transcriptions", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "audio/webm",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" })
    const { env, run } = createFixture()

    const response = await audioRoutes.request(streamedRequest, undefined, env)

    expect(response.status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce()
    expect(run).not.toHaveBeenCalled()
  })

  it("returns 422 when the model detects no speech", async () => {
    const { env, run } = createFixture({ text: "   " })

    const response = await audioRoutes.request(
      request(new Uint8Array([1, 2, 3])),
      undefined,
      env,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: "No speech detected" })
    expect(run).toHaveBeenCalledOnce()
  })

  it("returns 502 without exposing model failures", async () => {
    const { env, run } = createFixture()
    run.mockRejectedValueOnce(new Error("provider secret failure"))

    const response = await audioRoutes.request(
      request(new Uint8Array([1, 2, 3])),
      undefined,
      env,
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: "Audio transcription failed",
    })
  })
})
