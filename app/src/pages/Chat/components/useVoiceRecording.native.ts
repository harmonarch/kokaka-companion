import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio"
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

const validationMessages: Record<VoiceRecordingValidationError, string> = {
  too_short: "录音时间太短",
  empty: "没有录到声音",
  too_large: "录音太大，请缩短录音时间",
  unsupported_type: "此设备的录音格式不受支持",
}

async function loadRecording(uri: string) {
  const response = await fetch(uri)
  const blob = await response.blob()
  return blob.type === "audio/mp4"
    ? blob
    : blob.slice(0, blob.size, "audio/mp4")
}

export function useVoiceRecording({
  onTranscribeRecording,
  onTranscription,
}: {
  onTranscribeRecording: (audio: Blob, signal?: AbortSignal) => Promise<string>
  onTranscription: (text: string) => void
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [status, setStatusState] = useState<VoiceRecordingStatus>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const mountedRef = useRef(true)
  const statusRef = useRef<VoiceRecordingStatus>("idle")
  const operationIdRef = useRef(0)
  const interactionActiveRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const retainedRecordingRef = useRef<Blob | null>(null)
  const transcriptionAbortRef = useRef<AbortController | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maximumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishRecordingRef = useRef<(discard: boolean) => void>(() => undefined)
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

  const finishRecording = useCallback(
    async (discard: boolean) => {
      if (
        statusRef.current !== "recording" &&
        statusRef.current !== "cancelled"
      ) {
        return
      }

      interactionActiveRef.current = false
      cancelRequestedRef.current ||= discard
      clearTimers()
      const operationId = operationIdRef.current
      const startedAt = startedAtRef.current
      const durationMs = startedAt ? Date.now() - startedAt : 0
      startedAtRef.current = null

      try {
        await recorder.stop()
        await setAudioModeAsync({ allowsRecording: false }).catch(
          () => undefined,
        )
        if (!mountedRef.current || operationId !== operationIdRef.current)
          return
        if (cancelRequestedRef.current) {
          setMessage("已取消")
          setStatus("idle")
          return
        }

        const uri = recorder.uri
        if (!uri) throw new Error("Missing recording URI")
        const recording = await loadRecording(uri)
        if (!mountedRef.current || operationId !== operationIdRef.current)
          return
        const validation = validateVoiceRecording({
          durationMs,
          sizeBytes: recording.size,
          mimeType: recording.type,
        })
        if (!validation.valid) {
          setMessage(validationMessages[validation.error])
          setStatus("error")
          return
        }
        void transcribe(recording, operationId)
      } catch {
        if (!mountedRef.current || operationId !== operationIdRef.current)
          return
        setMessage("无法录音，请重试")
        setStatus("error")
      }
    },
    [clearTimers, recorder, setStatus, transcribe],
  )

  finishRecordingRef.current = (discard) => {
    void finishRecording(discard)
  }

  const beginRecording = useCallback(async () => {
    if (
      interactionActiveRef.current ||
      statusRef.current === "requesting" ||
      statusRef.current === "recording" ||
      statusRef.current === "transcribing"
    ) {
      return
    }

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    interactionActiveRef.current = true
    cancelRequestedRef.current = false
    retainedRecordingRef.current = null
    startedAtRef.current = null
    setElapsedMs(0)
    setMessage("等待麦克风权限")
    setStatus("requesting")

    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        interactionActiveRef.current = false
        setMessage("无法使用麦克风，请在系统设置中允许权限")
        setStatus("error")
        return
      }
      if (
        !mountedRef.current ||
        operationId !== operationIdRef.current ||
        !interactionActiveRef.current
      ) {
        return
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      })
      await recorder.prepareToRecordAsync()
      if (
        !mountedRef.current ||
        operationId !== operationIdRef.current ||
        !interactionActiveRef.current
      ) {
        return
      }

      recorder.record()
      startedAtRef.current = Date.now()
      setMessage("录音中")
      setStatus("recording")
      elapsedTimerRef.current = setInterval(() => {
        if (startedAtRef.current && mountedRef.current) {
          setElapsedMs(Date.now() - startedAtRef.current)
        }
      }, 100)
      maximumTimerRef.current = setTimeout(() => {
        setElapsedMs(maximumVoiceRecordingDurationMs)
        finishRecordingRef.current(false)
      }, maximumVoiceRecordingDurationMs)
    } catch {
      if (!mountedRef.current || operationId !== operationIdRef.current) return
      interactionActiveRef.current = false
      setMessage("无法使用麦克风，请检查系统权限")
      setStatus("error")
    }
  }, [recorder, setStatus])

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
    void finishRecording(cancelRequestedRef.current)
  }, [finishRecording, setStatus])

  const cancelRecording = useCallback(() => {
    if (!interactionActiveRef.current) return
    cancelRequestedRef.current = true
    void finishRecording(true)
  }, [finishRecording])

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
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && interactionActiveRef.current) {
        cancelRequestedRef.current = true
        finishRecordingRef.current(true)
      }
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationIdRef.current += 1
      interactionActiveRef.current = false
      cancelRequestedRef.current = true
      clearTimers()
      transcriptionAbortRef.current?.abort()
      transcriptionAbortRef.current = null
      retainedRecordingRef.current = null
      if (recorder.isRecording) void recorder.stop()
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)
    }
  }, [clearTimers, recorder])

  return {
    available: true,
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
