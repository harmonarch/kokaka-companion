import { afterEach, describe, expect, it, vi } from "vitest"
import { MessageCollector } from "./message-collector"
import type { EvalResult, MessageEvaluator, PendingMessage } from "./types"

const config = {
  responseTimeoutMs: 5000,
  nudgeTimeoutMs: 10000,
  gentleTimeoutMs: 20000,
  evalIntervalMs: 1000,
}

function createHarness(evaluator: Partial<MessageEvaluator> = {}) {
  let now = 0
  const submissions: Array<{
    pending: PendingMessage[]
    expressionGroupId: string
    gentle: boolean
  }> = []
  const nudges: string[] = []
  const errors: unknown[] = []
  const completeEvaluator: MessageEvaluator = {
    evaluate: vi.fn(async (): Promise<EvalResult> => ({
      status: "complete",
      emotionIntensity: 0.5,
    })),
    generateNudge: vi.fn(async () => "嗯，我在听"),
    ...evaluator,
  }
  const collector = new MessageCollector(
    config,
    {
      onSubmit: async (input) => {
        submissions.push(input)
      },
      onNudge: (text) => nudges.push(text),
      onError: (error) => errors.push(error),
    },
    completeEvaluator,
    () => now,
  )

  return {
    collector,
    evaluator: completeEvaluator,
    submissions,
    nudges,
    errors,
    setNow: (value: number) => {
      now = value
    },
    advance: async (ms: number) => {
      now += ms
      await vi.advanceTimersByTimeAsync(ms)
    },
  }
}

describe("MessageCollector", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("waits until 5 seconds of silence before evaluating", async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "我今天有点烦",
    })

    await harness.advance(4999)

    expect(harness.evaluator.evaluate).not.toHaveBeenCalled()
    expect(harness.submissions).toHaveLength(0)
  })

  it("submits one expression after complete evaluation", async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "我今天有点烦",
    })
    harness.setNow(1000)
    harness.collector.addMessage({
      id: "m2",
      sessionId: "s1",
      content: "其实也不是烦",
    })

    await harness.advance(5000)

    expect(harness.evaluator.evaluate).toHaveBeenCalledWith([
      "我今天有点烦",
      "其实也不是烦",
    ])
    expect(harness.submissions).toHaveLength(1)
    expect(harness.submissions[0].gentle).toBe(false)
    expect(harness.submissions[0].pending.map((message) => message.id)).toEqual(
      ["m1", "m2"],
    )
  })

  it("sends one nudge at 10 seconds without clearing pending", async () => {
    vi.useFakeTimers()
    const evaluator: MessageEvaluator = {
      evaluate: vi.fn(async (): Promise<EvalResult> => ({
        status: "trailing_off",
        emotionIntensity: 0.5,
      })),
      generateNudge: vi.fn(async () => "嗯，我在听"),
    }
    const harness = createHarness(evaluator)
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "算了",
    })

    await harness.advance(10000)
    await harness.advance(5000)

    expect(harness.nudges).toEqual(["嗯，我在听"])
    expect(harness.submissions).toHaveLength(0)
  })

  it("sends gentle response at 20 seconds and ends the group", async () => {
    vi.useFakeTimers()
    const harness = createHarness({
      evaluate: vi.fn(async (): Promise<EvalResult> => ({
        status: "venting",
        emotionIntensity: 0.9,
      })),
    })
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "我不知道怎么说",
    })

    await harness.advance(20000)

    expect(harness.submissions).toHaveLength(1)
    expect(harness.submissions[0].gentle).toBe(true)
    expect(harness.submissions[0].pending[0].content).toBe("我不知道怎么说")
  })

  it("submits immediately when done is forced", async () => {
    vi.useFakeTimers()
    const harness = createHarness({
      evaluate: vi.fn(async (): Promise<EvalResult> => ({
        status: "mid_thought",
        emotionIntensity: 0.2,
      })),
    })
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "我想说的是",
    })

    await harness.collector.forceDone()

    expect(harness.evaluator.evaluate).not.toHaveBeenCalled()
    expect(harness.submissions).toHaveLength(1)
    expect(harness.submissions[0].gentle).toBe(false)
  })

  it("does not submit a stale evaluation when a new message arrives", async () => {
    vi.useFakeTimers()
    let resolveEval: (value: EvalResult) => void = () => {}
    const harness = createHarness({
      evaluate: vi.fn(
        () =>
          new Promise<EvalResult>((resolve) => {
            resolveEval = resolve
          }),
      ),
    })
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "第一句",
    })

    await harness.advance(5000)
    harness.collector.addMessage({
      id: "m2",
      sessionId: "s1",
      content: "第二句",
    })
    resolveEval({ status: "complete", emotionIntensity: 0.5 })
    await Promise.resolve()

    expect(harness.submissions).toHaveLength(0)
  })

  it("clears the evaluation timer on dispose", async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    harness.collector.addMessage({
      id: "m1",
      sessionId: "s1",
      content: "第一句",
    })
    harness.collector.dispose()

    await harness.advance(6000)

    expect(harness.evaluator.evaluate).not.toHaveBeenCalled()
    expect(harness.submissions).toHaveLength(0)
  })
})
