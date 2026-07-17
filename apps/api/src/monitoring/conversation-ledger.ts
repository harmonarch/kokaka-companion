import type { Env } from "@/env"
import type { LlmCallObservation } from "@/monitoring/llm-call"

export type ObservationStatus =
  | "started"
  | "ok"
  | "degraded"
  | "partial"
  | "failed"

export type StartConversationObservationInput = {
  traceId: string
  primaryTraceId?: string
  userId: string
  conversationId?: string
  expressionGroupId?: string
  startedAt?: number
}

export type UpdateConversationObservationInput = {
  traceId: string
  status?: ObservationStatus
  degradationReason?: string
  firstResponseMs?: number
  totalDurationMs?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  modelCallCount?: number
  chatStored?: boolean
  contextStored?: boolean
  memoryStored?: boolean
  vectorStored?: boolean
  updatedAt?: number
}

export type RecordConversationObservationEventInput = {
  id?: string
  traceId: string
  stage: string
  status: ObservationStatus
  durationMs?: number
  provider?: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  errorCode?: string
  externalTraceId?: string
  occurredAt?: number
}

export async function isTokenUsageAnomalous(
  env: Env,
  input: {
    userId: string
    totalTokens: number
    operation?: string
    traceId?: string
  },
) {
  const configuredLimit = Number(env.TOKEN_ALERT_HARD_LIMIT)
  const hardLimit =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : 2000
  if (input.totalTokens >= hardLimit) return true

  const stage = `llm.${input.operation ?? "agent_reply"}`
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  const rows = await env.DB.prepare(
    `SELECT e.total_tokens AS totalTokens
     FROM conversation_observation_events e
     JOIN conversation_observations o ON o.trace_id = e.trace_id
     WHERE o.user_id = ?
       AND e.stage = ?
       AND e.trace_id != ?
       AND e.status = 'ok'
       AND e.total_tokens > 0
       AND e.occurred_at >= ?
     ORDER BY e.total_tokens ASC`,
  )
    .bind(input.userId, stage, input.traceId ?? "", since)
    .all<{ totalTokens: number }>()
    .catch(() => ({ results: [] }))
  const totals = (rows.results ?? [])
    .map((row) => Number(row.totalTokens))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)
  const midpoint = Math.floor(totals.length / 2)
  const baseline =
    totals.length % 2 === 0
      ? ((totals[midpoint - 1] ?? 0) + (totals[midpoint] ?? 0)) / 2
      : (totals[midpoint] ?? 0)
  return baseline >= 100 && input.totalTokens >= baseline * 3
}

export async function startConversationObservation(
  env: Env,
  input: StartConversationObservationInput,
) {
  const startedAt = input.startedAt ?? Date.now()
  await env.DB.prepare(
    `INSERT INTO conversation_observations (
      trace_id, primary_trace_id, user_id, conversation_id, expression_group_id,
      status, started_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.traceId,
      input.primaryTraceId ?? input.traceId,
      input.userId,
      input.conversationId ?? null,
      input.expressionGroupId ?? null,
      "started",
      startedAt,
      startedAt,
    )
    .run()
    .catch((error) => {
      console.error("Failed to start conversation observation", error)
    })
}

export async function updateConversationObservation(
  env: Env,
  input: UpdateConversationObservationInput,
) {
  await env.DB.prepare(
    `UPDATE conversation_observations SET
      status = CASE
        WHEN ? IS NULL THEN status
        WHEN status = 'failed' THEN status
        WHEN status = 'partial' AND ? IN ('started', 'ok', 'degraded') THEN status
        WHEN status = 'degraded' AND ? IN ('started', 'ok') THEN status
        ELSE ?
      END,
      degradation_reason = COALESCE(?, degradation_reason),
      first_response_ms = COALESCE(?, first_response_ms),
      total_duration_ms = COALESCE(?, total_duration_ms),
      prompt_tokens = COALESCE(?, prompt_tokens),
      completion_tokens = COALESCE(?, completion_tokens),
      total_tokens = COALESCE(?, total_tokens),
      model_call_count = COALESCE(?, model_call_count),
      chat_stored = COALESCE(?, chat_stored),
      context_stored = COALESCE(?, context_stored),
      memory_stored = COALESCE(?, memory_stored),
      vector_stored = COALESCE(?, vector_stored),
      updated_at = ?
    WHERE trace_id = ?`,
  )
    .bind(
      input.status ?? null,
      input.status ?? null,
      input.status ?? null,
      input.status ?? null,
      input.degradationReason ?? null,
      input.firstResponseMs ?? null,
      input.totalDurationMs ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.totalTokens ?? null,
      input.modelCallCount ?? null,
      input.chatStored === undefined ? null : Number(input.chatStored),
      input.contextStored === undefined ? null : Number(input.contextStored),
      input.memoryStored === undefined ? null : Number(input.memoryStored),
      input.vectorStored === undefined ? null : Number(input.vectorStored),
      input.updatedAt ?? Date.now(),
      input.traceId,
    )
    .run()
    .catch((error) => {
      console.error("Failed to update conversation observation", error)
    })
}

export async function recordConversationObservationEvent(
  env: Env,
  input: RecordConversationObservationEventInput,
) {
  await env.DB.prepare(
    `INSERT INTO conversation_observation_events (
      id, trace_id, stage, status, duration_ms, provider, model,
      prompt_tokens, completion_tokens, total_tokens, error_code,
      external_trace_id, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id ?? crypto.randomUUID(),
      input.traceId,
      input.stage,
      input.status,
      input.durationMs ?? null,
      input.provider ?? null,
      input.model ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.totalTokens ?? null,
      input.errorCode ?? null,
      input.externalTraceId ?? null,
      input.occurredAt ?? Date.now(),
    )
    .run()
    .catch((error) => {
      console.error("Failed to record conversation observation event", error)
    })
}

export async function appendConversationLlmCall(
  env: Env,
  input: { traceId: string; call: LlmCallObservation },
) {
  const usage = input.call.usage
  await recordConversationObservationEvent(env, {
    traceId: input.traceId,
    stage: `llm.${input.call.operation}`,
    status: input.call.status === "success" ? "ok" : "degraded",
    durationMs: input.call.durationMs,
    provider: input.call.provider,
    model: input.call.model,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
    errorCode: input.call.fallbackReason,
  })
  await env.DB.prepare(
    `UPDATE conversation_observations SET
      prompt_tokens = COALESCE(prompt_tokens, 0) + ?,
      completion_tokens = COALESCE(completion_tokens, 0) + ?,
      total_tokens = COALESCE(total_tokens, 0) + ?,
      model_call_count = COALESCE(model_call_count, 0) + 1,
      status = CASE
        WHEN status IN ('failed', 'partial') THEN status
        WHEN ? != 'success' THEN 'degraded'
        ELSE status
      END,
      degradation_reason = COALESCE(?, degradation_reason),
      updated_at = ?
    WHERE trace_id = ?`,
  )
    .bind(
      usage?.promptTokens ?? 0,
      usage?.completionTokens ?? 0,
      usage?.totalTokens ?? 0,
      input.call.status,
      input.call.fallbackReason ?? null,
      Date.now(),
      input.traceId,
    )
    .run()
    .catch((error) => {
      console.error("Failed to append conversation LLM call", error)
    })
}
