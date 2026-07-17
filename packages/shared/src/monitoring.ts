import { z } from "zod"

export const observationStatusSchema = z.enum([
  "started",
  "ok",
  "degraded",
  "partial",
  "failed",
])

export const monitoringQuerySchema = z.object({
  userId: z.string().trim().max(128).optional(),
  from: z.coerce.number().int().nonnegative(),
  to: z.coerce.number().int().positive(),
  status: observationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export const monitoringTraceSchema = z.object({
  traceId: z.string(),
  primaryTraceId: z.string(),
  userId: z.string(),
  conversationId: z.string().nullable(),
  expressionGroupId: z.string().nullable(),
  status: observationStatusSchema,
  degradationReason: z.string().nullable(),
  startedAt: z.number(),
  updatedAt: z.number(),
  firstResponseMs: z.number().nullable(),
  totalDurationMs: z.number().nullable(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  modelCallCount: z.number(),
  chatStored: z.boolean().nullable(),
  contextStored: z.boolean().nullable(),
  memoryStored: z.boolean().nullable(),
  vectorStored: z.boolean().nullable(),
})

export const monitoringEventSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  stage: z.string(),
  status: observationStatusSchema,
  durationMs: z.number().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  promptTokens: z.number().nullable(),
  completionTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
  errorCode: z.string().nullable(),
  externalTraceId: z.string().nullable(),
  occurredAt: z.number(),
})

export const monitoringSummarySchema = z.object({
  totalTraces: z.number(),
  healthyTraces: z.number(),
  unhealthyTraces: z.number(),
  activeTraces: z.number(),
  averageFirstResponseMs: z.number().nullable(),
  averageDurationMs: z.number().nullable(),
  totalTokens: z.number(),
  totalModelCalls: z.number(),
  storageFailureCount: z.number(),
})

export const monitoringOverviewSchema = z.object({
  summary: monitoringSummarySchema,
  traces: z.array(monitoringTraceSchema),
  events: z.array(monitoringEventSchema),
})

export type MonitoringQuery = z.infer<typeof monitoringQuerySchema>
export type MonitoringTrace = z.infer<typeof monitoringTraceSchema>
export type MonitoringEvent = z.infer<typeof monitoringEventSchema>
export type MonitoringSummary = z.infer<typeof monitoringSummarySchema>
export type MonitoringOverview = z.infer<typeof monitoringOverviewSchema>
