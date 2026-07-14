import type { ChatAgentContext } from "@ai-companion/shared"

export type ExpressionStatus =
  | "complete"
  | "mid_thought"
  | "trailing_off"
  | "venting"

export type EvalAction = "wait" | "nudge" | "respond" | "gentle_respond"

export type EvalResult = {
  status: ExpressionStatus
  emotionIntensity: number
}

export type PendingMessageInput = {
  id: string
  sessionId: string
  content: string
  agents?: ChatAgentContext[]
  traceId?: string
  receivedAt?: number
}

export type PendingMessage = PendingMessageInput & {
  receivedAt: number
}

export type TypingInput = {
  sessionId: string
  receivedAt?: number
}

export type TimingConfig = {
  responseTimeoutMs: number
  nudgeTimeoutMs: number
  gentleTimeoutMs: number
  evalIntervalMs: number
}

export type MessageCollectorCallbacks = {
  onStatus?: (status: "listening" | "replying", traceId?: string) => void
  onSubmit: (input: {
    pending: PendingMessage[]
    expressionGroupId: string
    gentle: boolean
    replyingStartedAt: number
  }) => Promise<void>
  onNudge: (text: string, traceId?: string) => void
  onError: (error: unknown, traceId?: string) => void
}

export type MessageEvaluator = {
  evaluate: (pending: string[]) => Promise<EvalResult>
  generateNudge: (pending: string[]) => Promise<string>
}
