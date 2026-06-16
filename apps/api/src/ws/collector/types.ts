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
  receivedAt?: number
}

export type PendingMessage = PendingMessageInput & {
  receivedAt: number
}

export type TimingConfig = {
  responseTimeoutMs: number
  nudgeTimeoutMs: number
  gentleTimeoutMs: number
  evalIntervalMs: number
}

export type MessageCollectorCallbacks = {
  onStatus?: (status: "listening" | "replying") => void
  onSubmit: (input: {
    pending: PendingMessage[]
    expressionGroupId: string
    gentle: boolean
    replyingStartedAt: number
  }) => Promise<void>
  onNudge: (text: string) => void
  onError: (error: unknown) => void
}

export type MessageEvaluator = {
  evaluate: (pending: string[]) => Promise<EvalResult>
  generateNudge: (pending: string[]) => Promise<string>
}
