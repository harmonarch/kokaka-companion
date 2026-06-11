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

export type PendingMessage = {
  id: string
  sessionId: string
  content: string
  receivedAt: number
}

export type TimingConfig = {
  responseTimeoutMs: number
  nudgeTimeoutMs: number
  gentleTimeoutMs: number
  evalIntervalMs: number
}

export type MessageCollectorCallbacks = {
  onSubmit: (input: {
    pending: PendingMessage[]
    expressionGroupId: string
    gentle: boolean
  }) => Promise<void>
  onNudge: (text: string) => void
  onError: (error: unknown) => void
}

export type MessageEvaluator = {
  evaluate: (pending: string[]) => Promise<EvalResult>
  generateNudge: (pending: string[]) => Promise<string>
}
