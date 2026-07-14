import type { Env } from "@/env"
import type { EvalResult, ExpressionStatus, MessageEvaluator } from "./types"
import { observeLlmCall, type LlmCallObservation } from "@/monitoring/llm-call"

const EVAL_SYSTEM_PROMPT = `你是一个情感对话分析器。分析用户发送的多条消息，判断两件事：

1. 表达状态（status），必须是以下四个之一：
   - complete: 表达了一个相对完整的想法或情绪，到了自然停顿点
   - mid_thought: 话明显没说完（句子不完整、以连接词结尾等）
   - trailing_off: 在犹豫要不要继续说（"算了"、"不知道怎么说"等）
   - venting: 在密集宣泄情绪，节奏快，可能还想继续

2. 情绪强度（emotionIntensity），0到1的数字：
   - 0: 平静陈述
   - 0.5: 有明显情绪
   - 1: 情绪非常强烈

严格按以下 JSON 格式返回，不要包含其他内容：
{"status": "...", "emotionIntensity": 0.0}`

const NUDGE_SYSTEM_PROMPT = `用户在表达情绪，似乎停顿了。
生成一个很短的、温柔的回应，表示你在倾听。
不要分析或解决问题，不要问引导性问题。
只是让对方知道你在这里。
例如："嗯，我在听"、"慢慢说，不着急"、"嗯…"
不超过10个字。只返回回应文本。`

const NUDGE_FALLBACKS = [
  "嗯，我在听",
  "我在呢",
  "慢慢说，不着急",
  "嗯…",
  "我在这里",
  "没关系，想说的时候再说",
]

const validStatuses: ExpressionStatus[] = [
  "complete",
  "mid_thought",
  "trailing_off",
  "venting",
]

export class LLMEvaluator implements MessageEvaluator {
  private lastFallbackIndex = -1
  private observations: LlmCallObservation[] = []

  constructor(private readonly env: Env) {}

  drainObservations() {
    return this.observations.splice(0)
  }

  async evaluate(pending: string[]): Promise<EvalResult> {
    if (!this.env.DEEPSEEK_API_KEY) {
      this.observeFallback("expression_evaluation", "provider_not_configured")
      return { status: "complete", emotionIntensity: 0.5 }
    }

    const userContent = pending
      .map((message, index) => `[${index + 1}] ${message}`)
      .join("\n")

    return this.withRetry(
      async () => {
        const response = await fetch(
          `${this.env.DEEPSEEK_BASE_URL}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: this.env.DEEPSEEK_MODEL,
              messages: [
                { role: "system", content: EVAL_SYSTEM_PROMPT },
                { role: "user", content: userContent },
              ],
              temperature: 0,
              max_tokens: 50,
            }),
          },
        )
        if (!response.ok) throw new LlmCallFailure(`http_${response.status}`)
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: ProviderUsage
        }
        return {
          value: parseEvalResult(data.choices?.[0]?.message?.content ?? ""),
          usage: data.usage,
        }
      },
      { status: "complete", emotionIntensity: 0.5 },
      "expression_evaluation",
    )
  }

  async generateNudge(pending: string[]): Promise<string> {
    if (!this.env.DEEPSEEK_API_KEY) {
      this.observeFallback("nudge_generation", "provider_not_configured")
      return this.getFallbackNudge()
    }

    return this.withRetry(
      async () => {
        const response = await fetch(
          `${this.env.DEEPSEEK_BASE_URL}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${this.env.DEEPSEEK_API_KEY}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: this.env.DEEPSEEK_MODEL,
              messages: [
                { role: "system", content: NUDGE_SYSTEM_PROMPT },
                { role: "user", content: pending.join("\n") },
              ],
              temperature: 0.7,
              max_tokens: 20,
            }),
          },
        )
        if (!response.ok) throw new LlmCallFailure(`http_${response.status}`)
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: ProviderUsage
        }
        const content = data.choices?.[0]?.message?.content?.trim()
        if (!content) throw new LlmCallFailure("empty_response")
        return { value: content, usage: data.usage }
      },
      this.getFallbackNudge(),
      "nudge_generation",
    )
  }

  private async withRetry<T>(
    fn: () => Promise<{ value: T; usage?: ProviderUsage }>,
    fallback: T,
    operation: string,
  ): Promise<T> {
    const maxRetries = 3
    const baseDelay = 300
    const maxDelay = 2000
    const startedAt = Date.now()
    let fallbackReason = "request_error"

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await fn()
        this.recordObservation({
          provider: this.env.LLM_PROVIDER,
          model: this.env.DEEPSEEK_MODEL,
          operation,
          durationMs: Date.now() - startedAt,
          status: "success",
          retries: attempt,
          usage: result.usage,
        })
        return result.value
      } catch (error) {
        fallbackReason =
          error instanceof LlmCallFailure ? error.reason : "request_error"
        if (attempt === maxRetries) {
          this.recordObservation({
            provider: this.env.LLM_PROVIDER,
            model: this.env.DEEPSEEK_MODEL,
            operation,
            durationMs: Date.now() - startedAt,
            status: "fallback",
            retries: maxRetries,
            fallbackReason,
          })
          return fallback
        }
        const delay = Math.min(baseDelay * 2 ** attempt, maxDelay)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return fallback
  }

  private observeFallback(operation: string, fallbackReason: string) {
    this.recordObservation({
      provider: this.env.LLM_PROVIDER ?? "deepseek",
      model: this.env.DEEPSEEK_MODEL,
      operation,
      durationMs: 0,
      status: "fallback",
      retries: 0,
      fallbackReason,
    })
  }

  private recordObservation(input: Parameters<typeof observeLlmCall>[0]) {
    this.observations.push(observeLlmCall(input))
  }

  private getFallbackNudge() {
    let index =
      crypto.getRandomValues(new Uint32Array(1))[0] % NUDGE_FALLBACKS.length
    if (index === this.lastFallbackIndex && NUDGE_FALLBACKS.length > 1) {
      index = (index + 1) % NUDGE_FALLBACKS.length
    }
    this.lastFallbackIndex = index
    return NUDGE_FALLBACKS[index]
  }
}

type ProviderUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

class LlmCallFailure extends Error {
  constructor(readonly reason: string) {
    super(reason)
  }
}

function parseEvalResult(content: string): EvalResult {
  const parsed = JSON.parse(content) as {
    status?: unknown
    emotionIntensity?: unknown
  }
  const status = parsed.status
  if (typeof status !== "string" || !isExpressionStatus(status)) {
    throw new Error("Invalid expression status")
  }
  const emotionIntensity =
    typeof parsed.emotionIntensity === "number" &&
    Number.isFinite(parsed.emotionIntensity)
      ? Math.min(Math.max(parsed.emotionIntensity, 0), 1)
      : 0.5
  return { status, emotionIntensity }
}

function isExpressionStatus(value: string): value is ExpressionStatus {
  return validStatuses.includes(value as ExpressionStatus)
}
