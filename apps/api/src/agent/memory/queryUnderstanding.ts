import type { Env } from "@/env"
import { observeLlmCall, type LlmCallObservation } from "@/monitoring/llm-call"

export type MemoryQueryIntent = {
  query: string
  keywords: string[]
  wantsStructured: boolean
  wantsTimeRange: boolean
  wantsSemantic: boolean
}

function heuristicUnderstandMemoryQuery(query: string): MemoryQueryIntent {
  return {
    query,
    keywords:
      query
        .match(/《[^》]{1,40}》|[\u4e00-\u9fa5A-Za-z0-9]{2,}/g)
        ?.slice(0, 8) ?? [],
    wantsStructured:
      /(生日|姓名|名字|职业|工作|公司|在哪|所在地|住哪|住在|住)/.test(query),
    wantsTimeRange:
      /(昨天|上周|最近一周|最近|这段时间|去年|上个月|半年前)/.test(query),
    wantsSemantic: true,
  }
}

function normalizeIntent(value: unknown, query: string): MemoryQueryIntent {
  const fallback = heuristicUnderstandMemoryQuery(query)
  if (!value || typeof value !== "object") return fallback
  const raw = value as Partial<MemoryQueryIntent>
  return {
    query,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.filter((item): item is string => typeof item === "string")
      : fallback.keywords,
    wantsStructured:
      typeof raw.wantsStructured === "boolean"
        ? raw.wantsStructured
        : fallback.wantsStructured,
    wantsTimeRange:
      typeof raw.wantsTimeRange === "boolean"
        ? raw.wantsTimeRange
        : fallback.wantsTimeRange,
    wantsSemantic:
      typeof raw.wantsSemantic === "boolean"
        ? raw.wantsSemantic
        : fallback.wantsSemantic,
  }
}

function parseJsonObject(value: string) {
  const match = value.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as unknown
  } catch {
    return null
  }
}

export async function understandMemoryQuery(
  env: Env,
  query: string,
  options?: { onLlmCall?: (call: LlmCallObservation) => void },
) {
  const fallback = heuristicUnderstandMemoryQuery(query)
  const startedAt = Date.now()
  const report = (
    status: LlmCallObservation["status"],
    fallbackReason?: string,
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    },
  ) => {
    const observation = observeLlmCall({
      provider: "deepseek",
      model: env.DEEPSEEK_MODEL,
      operation: "query_understanding",
      durationMs: Date.now() - startedAt,
      status,
      retries: 0,
      usage,
      fallbackReason,
    })
    options?.onLlmCall?.(observation)
  }
  if (!env.DEEPSEEK_API_KEY) {
    report("fallback", "provider_not_configured")
    return fallback
  }
  try {
    const response = await fetch(
      `${env.DEEPSEEK_BASE_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          messages: [
            {
              role: "system",
              content: [
                "你是记忆检索查询理解器，只返回 JSON。",
                "格式：",
                '{"keywords":["..."],"wantsStructured":true,"wantsTimeRange":false,"wantsSemantic":true}',
                "structured 用于姓名、生日、职业、公司、所在地等确定事实。",
                "timeRange 用于昨天、上周、最近、去年等时间范围。",
                "semantic 用于模糊回忆、情感关联、开放问题。",
              ].join("\n"),
            },
            { role: "user", content: query },
          ],
          temperature: 0,
          max_tokens: 160,
        }),
      },
    )
    if (!response.ok) {
      report("fallback", `http_${response.status}`)
      return fallback
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
    }
    const parsed = parseJsonObject(data.choices?.[0]?.message?.content ?? "")
    if (!parsed) {
      report("fallback", "invalid_response", data.usage)
      return fallback
    }
    report("success", undefined, data.usage)
    return normalizeIntent(parsed, query)
  } catch {
    report("fallback", "request_error")
    return fallback
  }
}
