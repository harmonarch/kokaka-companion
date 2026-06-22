import type {
  EvalAction,
  ExpressionStatus,
  MessageCollectorCallbacks,
  MessageEvaluator,
  PendingMessageInput,
  PendingMessage,
  TimingConfig,
  TypingInput,
} from "./types"

const defaultConfig: TimingConfig = {
  responseTimeoutMs: 5000,
  nudgeTimeoutMs: 10000,
  gentleTimeoutMs: 20000,
  evalIntervalMs: 1000,
}

export class MessageCollector {
  private readonly config: TimingConfig
  private pending: PendingMessage[] = []
  private expressionGroupId: string | null = null
  private evalTimer: ReturnType<typeof setInterval> | null = null
  private nudgeSent = false
  private evaluating = false
  private lastActivityAt: number | null = null

  constructor(
    config: Partial<TimingConfig>,
    private readonly callbacks: MessageCollectorCallbacks,
    private readonly evaluator: MessageEvaluator,
    private readonly now = () => Date.now(),
  ) {
    this.config = { ...defaultConfig, ...config }
  }

  addMessage(input: PendingMessageInput) {
    if (!this.expressionGroupId) {
      this.expressionGroupId = crypto.randomUUID()
      this.nudgeSent = false
    }
    const receivedAt = input.receivedAt ?? this.now()
    this.pending.push({
      id: input.id,
      sessionId: input.sessionId,
      content: input.content,
      agents: input.agents,
      receivedAt,
    })
    this.lastActivityAt = Math.max(this.lastActivityAt ?? 0, receivedAt)
    this.callbacks.onStatus?.("listening")
    this.startEvalLoop()
  }

  noteTyping(input: TypingInput) {
    if (this.pending.length === 0) return
    if (this.pending.at(-1)?.sessionId !== input.sessionId) return

    const receivedAt = input.receivedAt ?? this.now()
    this.lastActivityAt = Math.max(this.lastActivityAt ?? 0, receivedAt)
  }

  async forceDone() {
    this.stopEvalLoop()
    await this.submit(false)
  }

  dispose() {
    this.stopEvalLoop()
    this.pending = []
    this.expressionGroupId = null
    this.nudgeSent = false
    this.lastActivityAt = null
  }

  private startEvalLoop() {
    if (this.evalTimer) return
    this.evalTimer = setInterval(() => {
      void this.evaluatePending().catch((error) => {
        this.callbacks.onError(error)
      })
    }, this.config.evalIntervalMs)
  }

  private stopEvalLoop() {
    if (!this.evalTimer) return
    clearInterval(this.evalTimer)
    this.evalTimer = null
  }

  private async evaluatePending() {
    if (this.evaluating || this.pending.length === 0) return

    const silence = this.getSilence()
    if (silence < this.config.responseTimeoutMs) return

    if (silence >= this.config.gentleTimeoutMs) {
      await this.executeAction("gentle_respond")
      return
    }

    const evaluatedCount = this.pending.length
    const evaluatedActivityAt = this.lastActivityAt
    this.evaluating = true
    try {
      const result = await this.evaluator.evaluate(
        this.pending.map((message) => message.content),
      )
      if (
        this.pending.length !== evaluatedCount ||
        this.lastActivityAt !== evaluatedActivityAt
      ) {
        return
      }

      const action = this.decide(result.status, silence)
      await this.executeAction(action)
    } catch (error) {
      this.callbacks.onError(error)
      if (
        this.pending.length === evaluatedCount &&
        this.lastActivityAt === evaluatedActivityAt
      ) {
        await this.executeAction("respond")
      }
    } finally {
      this.evaluating = false
    }
  }

  private decide(status: ExpressionStatus, silence: number): EvalAction {
    if (silence >= this.config.gentleTimeoutMs) return "gentle_respond"

    switch (status) {
      case "complete":
        return "respond"
      case "trailing_off":
        if (silence >= this.config.nudgeTimeoutMs && !this.nudgeSent) {
          return "nudge"
        }
        return "wait"
      case "mid_thought":
      case "venting":
        return "wait"
      default:
        return "wait"
    }
  }

  private async executeAction(action: EvalAction) {
    switch (action) {
      case "wait":
        return
      case "nudge": {
        const nudge = await this.evaluator.generateNudge(
          this.pending.map((message) => message.content),
        )
        this.callbacks.onNudge(nudge)
        this.nudgeSent = true
        return
      }
      case "respond":
        this.stopEvalLoop()
        await this.submit(false)
        return
      case "gentle_respond":
        this.stopEvalLoop()
        await this.submit(true)
        return
    }
  }

  private async submit(gentle: boolean) {
    if (this.pending.length === 0 || !this.expressionGroupId) return

    const pending = [...this.pending]
    const expressionGroupId = this.expressionGroupId
    this.pending = []
    this.expressionGroupId = null
    this.nudgeSent = false
    this.lastActivityAt = null

    const replyingStartedAt = this.now()
    this.callbacks.onStatus?.("replying")
    await this.callbacks.onSubmit({
      pending,
      expressionGroupId,
      gentle,
      replyingStartedAt,
    })
  }

  private getSilence() {
    if (this.lastActivityAt === null) return 0
    return Math.max(0, this.now() - this.lastActivityAt)
  }
}
