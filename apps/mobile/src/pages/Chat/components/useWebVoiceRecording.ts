import { useCallback, useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import { ApiError } from "@ai-companion/api-client"
import {
  getVoiceTranscriptionClientErrorMessage,
  maximumVoiceRecordingDurationMs,
  validateVoiceRecording,
  type VoiceRecordingValidationError,
} from "./voiceRecording"

type VoiceRecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "cancelled"
  | "transcribing"
  | "failed"
  | "error"

const recordingMimeTypeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
]

const validationMessages: Record<VoiceRecordingValidationError, string> = {
  too_short: "录音时间太短",
  empty: "没有录到声音",
  too_large: "录音太大，请缩短录音时间",
  unsupported_type: "此浏览器的录音格式不受支持",
}

function getSupportedRecordingMimeType() {
  if (
    Platform.OS !== "web" ||
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return null
  }

  return (
    recordingMimeTypeCandidates.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? null
  )
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useWebVoiceRecording({
  onTranscribeRecording,
  onTranscription,
}: {
  onTranscribeRecording: (audio: Blob, signal?: AbortSignal) => Promise<string>
  onTranscription: (text: string) => void
}) {
  const [available, setAvailable] = useState(
    () => getSupportedRecordingMimeType() !== null,
  )
  const [status, setStatusState] = useState<VoiceRecordingStatus>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const mountedRef = useRef(true)
  const statusRef = useRef<VoiceRecordingStatus>("idle")
  const operationIdRef = useRef(0)
  const interactionActiveRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef("")
  const startedAtRef = useRef<number | null>(null)
  const stoppedAtRef = useRef<number | null>(null)
  const stopWhenStartedRef = useRef<"submit" | "discard" | null>(null)
  const retainedRecordingRef = useRef<Blob | null>(null)
  const transcriptionAbortRef = useRef<AbortController | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maximumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcribeRef = useRef(onTranscribeRecording)
  const transcriptionRef = useRef(onTranscription)

  transcribeRef.current = onTranscribeRecording
  transcriptionRef.current = onTranscription

  const setStatus = useCallback((nextStatus: VoiceRecordingStatus) => {
    statusRef.current = nextStatus
    if (mountedRef.current) setStatusState(nextStatus)
  }, [])

  const clearTimers = useCallback(() => {
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    if (maximumTimerRef.current) clearTimeout(maximumTimerRef.current)
    elapsedTimerRef.current = null
    maximumTimerRef.current = null
  }, [])

  const releaseStream = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
  }, [])

  const transcribe = useCallback(
    async (recording: Blob, operationId: number) => {
      transcriptionAbortRef.current?.abort()
      const controller = new AbortController()
      transcriptionAbortRef.current = controller
      retainedRecordingRef.current = recording
      setStatus("transcribing")
      setMessage("正在转成文字")
      try {
        const text = await transcribeRef.current(recording, controller.signal)
        if (!mountedRef.current || operationId !== operationIdRef.current)
          return
        transcriptionAbortRef.current = null
        retainedRecordingRef.current = null
        transcriptionRef.current(text)
        setMessage(null)
        setStatus("idle")
      } catch (error) {
        if (!mountedRef.current || operationId !== operationIdRef.current)
          return
        transcriptionAbortRef.current = null
        const clientErrorMessage =
          error instanceof ApiError
            ? getVoiceTranscriptionClientErrorMessage(error.status)
            : null
        if (error instanceof ApiError && error.status === 429) {
          setMessage("请求过于频繁，请稍后重试")
          setStatus("failed")
          return
        }
        if (clientErrorMessage) {
          retainedRecordingRef.current = null
          setMessage(clientErrorMessage)
          setStatus("error")
          return
        }
        setMessage("转写失败")
        setStatus("failed")
      }
    },
    [setStatus],
  )

  const finishStoppedRecording = useCallback(
    (operationId: number) => {
      clearTimers()
      const recorder = recorderRef.current
      if (!recorder) return
      const startedAt = startedAtRef.current
      const stoppedAt = stoppedAtRef.current ?? performance.now()
      const shouldDiscard = cancelRequestedRef.current
      const mimeType = recorder.mimeType || mimeTypeRef.current
      const recording = new Blob(chunksRef.current, { type: mimeType })

      recorderRef.current = null
      chunksRef.current = []
      startedAtRef.current = null
      stoppedAtRef.current = null
      stopWhenStartedRef.current = null
      releaseStream()

      if (!mountedRef.current || operationId !== operationIdRef.current) return
      if (shouldDiscard || startedAt === null) {
        setMessage(shouldDiscard ? "已取消" : null)
        setStatus("idle")
        return
      }

      const validation = validateVoiceRecording({
        durationMs: Math.max(0, stoppedAt - startedAt),
        sizeBytes: recording.size,
        mimeType: recording.type,
      })
      if (!validation.valid) {
        setMessage(validationMessages[validation.error])
        setStatus("error")
        return
      }

      void transcribe(recording, operationId)
    },
    [clearTimers, releaseStream, setStatus, transcribe],
  )

  const stopActiveRecorder = useCallback(
    (discard: boolean) => {
      cancelRequestedRef.current ||= discard
      interactionActiveRef.current = false
      const recorder = recorderRef.current
      if (!recorder) return
      if (recorder.state === "inactive") {
        stopWhenStartedRef.current = discard ? "discard" : "submit"
        return
      }
      if (startedAtRef.current !== null)
        stoppedAtRef.current = performance.now()
      clearTimers()
      recorder.stop()
    },
    [clearTimers],
  )

  const cancelPendingOrActive = useCallback(
    (showMessage: boolean) => {
      interactionActiveRef.current = false
      cancelRequestedRef.current = true
      retainedRecordingRef.current = null
      transcriptionAbortRef.current?.abort()
      transcriptionAbortRef.current = null
      if (!recorderRef.current) {
        operationIdRef.current += 1
        releaseStream()
        clearTimers()
        if (showMessage) {
          setMessage("已取消")
          setStatus("idle")
        } else {
          setMessage(null)
          setStatus("idle")
        }
        return
      }
      if (!showMessage) {
        operationIdRef.current += 1
        setMessage(null)
        setStatus("idle")
      }
      if (showMessage) {
        setMessage("松开以取消")
        setStatus("cancelled")
      }
      stopActiveRecorder(true)
    },
    [clearTimers, releaseStream, setStatus, stopActiveRecorder],
  )

  const beginRecording = useCallback(async () => {
    if (
      !available ||
      interactionActiveRef.current ||
      statusRef.current === "requesting" ||
      statusRef.current === "recording" ||
      statusRef.current === "transcribing"
    ) {
      return
    }

    const mimeType = getSupportedRecordingMimeType()
    if (!mimeType) return

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    interactionActiveRef.current = true
    cancelRequestedRef.current = false
    retainedRecordingRef.current = null
    chunksRef.current = []
    mimeTypeRef.current = mimeType
    startedAtRef.current = null
    stoppedAtRef.current = null
    stopWhenStartedRef.current = null
    setElapsedMs(0)
    setMessage("等待麦克风权限")
    setStatus("requesting")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (
        !mountedRef.current ||
        operationId !== operationIdRef.current ||
        !interactionActiveRef.current
      ) {
        stopStream(stream)
        if (mountedRef.current && operationId === operationIdRef.current) {
          setMessage(null)
          setStatus("idle")
        }
        return
      }

      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        if (operationId !== operationIdRef.current) return
        operationIdRef.current += 1
        interactionActiveRef.current = false
        cancelRequestedRef.current = true
        clearTimers()
        if (recorder.state !== "inactive") recorder.stop()
        releaseStream()
        if (mountedRef.current) {
          setMessage("无法录音，请重试")
          setStatus("error")
        }
      }
      recorder.onstart = () => {
        if (!mountedRef.current || operationId !== operationIdRef.current) {
          stopActiveRecorder(true)
          return
        }
        startedAtRef.current = performance.now()
        setMessage("录音中")
        setStatus("recording")
        elapsedTimerRef.current = setInterval(() => {
          if (startedAtRef.current !== null && mountedRef.current) {
            setElapsedMs(performance.now() - startedAtRef.current)
          }
        }, 100)
        maximumTimerRef.current = setTimeout(() => {
          stoppedAtRef.current = performance.now()
          setElapsedMs(maximumVoiceRecordingDurationMs)
          stopActiveRecorder(false)
        }, maximumVoiceRecordingDurationMs)

        const pendingStop = stopWhenStartedRef.current
        if (pendingStop) stopActiveRecorder(pendingStop === "discard")
      }
      recorder.onstop = () => finishStoppedRecording(operationId)
      recorder.start(100)
    } catch {
      releaseStream()
      if (!mountedRef.current || operationId !== operationIdRef.current) return
      interactionActiveRef.current = false
      setMessage("无法使用麦克风，请检查浏览器权限")
      setStatus("error")
    }
  }, [
    available,
    clearTimers,
    finishStoppedRecording,
    releaseStream,
    setStatus,
    stopActiveRecorder,
  ])

  const markCancelled = useCallback(() => {
    if (!interactionActiveRef.current || cancelRequestedRef.current) return
    cancelRequestedRef.current = true
    setMessage("松开以取消")
    setStatus("cancelled")
  }, [setStatus])

  const releaseRecording = useCallback(() => {
    if (!interactionActiveRef.current) return
    if (statusRef.current === "requesting") {
      interactionActiveRef.current = false
      operationIdRef.current += 1
      setMessage(null)
      setStatus("idle")
      return
    }
    stopActiveRecorder(cancelRequestedRef.current)
  }, [setStatus, stopActiveRecorder])

  const cancelRecording = useCallback(() => {
    if (!interactionActiveRef.current) return
    cancelPendingOrActive(true)
  }, [cancelPendingOrActive])

  const retry = useCallback(() => {
    const recording = retainedRecordingRef.current
    if (!recording || statusRef.current === "transcribing") return
    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    void transcribe(recording, operationId)
  }, [transcribe])

  const discard = useCallback(() => {
    operationIdRef.current += 1
    transcriptionAbortRef.current?.abort()
    transcriptionAbortRef.current = null
    retainedRecordingRef.current = null
    setMessage(null)
    setStatus("idle")
  }, [setStatus])

  useEffect(() => {
    setAvailable(getSupportedRecordingMimeType() !== null)
  }, [])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") cancelPendingOrActive(false)
    }
    const handlePageHide = () => cancelPendingOrActive(false)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [cancelPendingOrActive])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationIdRef.current += 1
      cancelRequestedRef.current = true
      interactionActiveRef.current = false
      clearTimers()
      transcriptionAbortRef.current?.abort()
      transcriptionAbortRef.current = null
      retainedRecordingRef.current = null
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") recorder.stop()
      releaseStream()
    }
  }, [clearTimers, releaseStream])

  return {
    available,
    status,
    message,
    elapsedMs,
    isBusy:
      status === "requesting" ||
      status === "recording" ||
      status === "cancelled" ||
      status === "transcribing",
    canRetry: status === "failed" && retainedRecordingRef.current !== null,
    beginRecording,
    markCancelled,
    releaseRecording,
    cancelRecording,
    retry,
    discard,
  }
}
