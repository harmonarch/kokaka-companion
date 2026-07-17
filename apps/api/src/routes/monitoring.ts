import { Hono } from "hono"
import {
  monitoringOverviewSchema,
  monitoringQuerySchema,
  type MonitoringEvent,
  type MonitoringTrace,
} from "@ai-companion/shared"
import type { AppBindings } from "@/middleware/auth"

type TraceRow = Omit<
  MonitoringTrace,
  "chatStored" | "contextStored" | "memoryStored" | "vectorStored"
> & {
  chatStored: number | null
  contextStored: number | null
  memoryStored: number | null
  vectorStored: number | null
}

export const monitoringRoutes = new Hono<AppBindings>()

monitoringRoutes.use("*", async (c, next) => {
  const expected = c.env.MONITORING_API_KEY?.trim()
  const supplied = c.req.header("x-monitoring-key")?.trim()
  if (!expected || !supplied || supplied !== expected) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  await next()
})

monitoringRoutes.get("/overview", async (c) => {
  const parsed = monitoringQuerySchema.safeParse(c.req.query())
  if (!parsed.success || parsed.data.from >= parsed.data.to) {
    return c.json({ error: "Invalid monitoring query" }, 400)
  }

  const { userId, from, to, status, limit } = parsed.data
  const clauses = ["started_at >= ?", "started_at <= ?"]
  const bindings: Array<string | number> = [from, to]
  if (userId) {
    clauses.push("user_id = ?")
    bindings.push(userId)
  }
  if (status) {
    clauses.push("status = ?")
    bindings.push(status)
  }
  const where = clauses.join(" AND ")

  const [traceResult, summary, eventResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
        trace_id AS traceId, primary_trace_id AS primaryTraceId,
        user_id AS userId, conversation_id AS conversationId,
        expression_group_id AS expressionGroupId, status,
        degradation_reason AS degradationReason, started_at AS startedAt,
        updated_at AS updatedAt, first_response_ms AS firstResponseMs,
        total_duration_ms AS totalDurationMs, prompt_tokens AS promptTokens,
        completion_tokens AS completionTokens, total_tokens AS totalTokens,
        model_call_count AS modelCallCount, chat_stored AS chatStored,
        context_stored AS contextStored, memory_stored AS memoryStored,
        vector_stored AS vectorStored
       FROM conversation_observations
       WHERE ${where}
       ORDER BY started_at DESC
       LIMIT ?`,
    )
      .bind(...bindings, limit)
      .all<TraceRow>(),
    c.env.DB.prepare(
      `SELECT
        COUNT(*) AS totalTraces,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS healthyTraces,
        SUM(CASE WHEN status IN ('degraded', 'partial', 'failed') THEN 1 ELSE 0 END) AS unhealthyTraces,
        SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) AS activeTraces,
        AVG(first_response_ms) AS averageFirstResponseMs,
        AVG(total_duration_ms) AS averageDurationMs,
        COALESCE(SUM(total_tokens), 0) AS totalTokens,
        COALESCE(SUM(model_call_count), 0) AS totalModelCalls,
        SUM(CASE WHEN chat_stored = 0 OR context_stored = 0 OR memory_stored = 0 OR vector_stored = 0 THEN 1 ELSE 0 END) AS storageFailureCount
       FROM conversation_observations
       WHERE ${where}`,
    )
      .bind(...bindings)
      .first<Record<string, number | null>>(),
    c.env.DB.prepare(
      `SELECT
        e.id, e.trace_id AS traceId, e.stage, e.status,
        e.duration_ms AS durationMs, e.provider, e.model,
        e.prompt_tokens AS promptTokens,
        e.completion_tokens AS completionTokens,
        e.total_tokens AS totalTokens, e.error_code AS errorCode,
        e.external_trace_id AS externalTraceId, e.occurred_at AS occurredAt
       FROM conversation_observation_events e
       JOIN conversation_observations o ON o.trace_id = e.trace_id
       WHERE ${where.replaceAll("started_at", "o.started_at").replaceAll("user_id", "o.user_id").replaceAll("status", "o.status")}
       ORDER BY e.occurred_at DESC
       LIMIT ?`,
    )
      .bind(...bindings, Math.min(limit * 10, 1000))
      .all<MonitoringEvent>(),
  ])

  const traces = (traceResult.results ?? []).map((trace) => ({
    ...trace,
    chatStored: trace.chatStored === null ? null : Boolean(trace.chatStored),
    contextStored:
      trace.contextStored === null ? null : Boolean(trace.contextStored),
    memoryStored:
      trace.memoryStored === null ? null : Boolean(trace.memoryStored),
    vectorStored:
      trace.vectorStored === null ? null : Boolean(trace.vectorStored),
  }))
  const payload = {
    summary: {
      totalTraces: Number(summary?.totalTraces ?? 0),
      healthyTraces: Number(summary?.healthyTraces ?? 0),
      unhealthyTraces: Number(summary?.unhealthyTraces ?? 0),
      activeTraces: Number(summary?.activeTraces ?? 0),
      averageFirstResponseMs:
        summary?.averageFirstResponseMs == null
          ? null
          : Math.round(summary.averageFirstResponseMs),
      averageDurationMs:
        summary?.averageDurationMs == null
          ? null
          : Math.round(summary.averageDurationMs),
      totalTokens: Number(summary?.totalTokens ?? 0),
      totalModelCalls: Number(summary?.totalModelCalls ?? 0),
      storageFailureCount: Number(summary?.storageFailureCount ?? 0),
    },
    traces,
    events: eventResult.results ?? [],
  }
  return c.json(monitoringOverviewSchema.parse(payload))
})
