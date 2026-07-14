import * as Sentry from "@sentry/react-native"
import type { HttpRequestObservation } from "@ai-companion/api-client"

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
export const monitoringEnabled = Boolean(dsn)
const environment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || "development"
const release = process.env.EXPO_PUBLIC_SENTRY_RELEASE?.trim() || undefined
const configuredSampleRate = Number(
  process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
)
const tracesSampleRate = Number.isFinite(configuredSampleRate)
  ? Math.min(Math.max(configuredSampleRate, 0), 1)
  : environment === "production"
    ? 0.1
    : 0

const sensitiveKey =
  /authorization|cookie|password|token|email|nickname|content|body|persona|prompt|query/i

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value)
    url.search = ""
    return url.toString()
  } catch {
    return value.split("?")[0] ?? value
  }
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (sensitiveKey.test(key)) return "[Filtered]"
  if (typeof value === "string" && /https?:\/\//i.test(value)) {
    return sanitizeUrl(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item))
  }
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey),
    ]),
  )
}

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
})

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate,
    integrations: [navigationIntegration],
    beforeSend(event) {
      event.request = event.request
        ? {
            method: event.request.method,
            url: event.request.url
              ? sanitizeUrl(event.request.url)
              : undefined,
          }
        : undefined
      event.user = event.user?.id ? { id: event.user.id } : undefined
      event.extra = sanitizeValue(event.extra) as typeof event.extra
      event.contexts = sanitizeValue(event.contexts) as typeof event.contexts
      event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        ...breadcrumb,
        data: sanitizeValue(breadcrumb.data) as typeof breadcrumb.data,
      }))
      return event
    },
  })
}

export function createTraceId() {
  return crypto.randomUUID()
}

export function setMonitoringUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null)
}

export type AppErrorContext = {
  operation: string
  traceId?: string
  conversationId?: string
  expressionGroupId?: string | null
}

export function captureAppError(error: unknown, context: AppErrorContext) {
  if (!dsn) return
  Sentry.withScope((scope) => {
    scope.setTag("operation", context.operation)
    if (context.traceId) scope.setTag("trace_id", context.traceId)
    if (context.conversationId) {
      scope.setTag("conversation_id", context.conversationId)
    }
    if (context.expressionGroupId) {
      scope.setTag("expression_group_id", context.expressionGroupId)
    }
    Sentry.captureException(error)
  })
}

export function recordHttpObservation(
  observation: HttpRequestObservation,
  error?: unknown,
) {
  Sentry.addBreadcrumb({
    category: "http",
    type: "http",
    level: error ? "error" : "info",
    message: `${observation.method} ${observation.path}`,
    data: {
      status: observation.status,
      duration_ms: observation.durationMs,
      trace_id: observation.traceId,
    },
  })
  if (error && (observation.status ?? 0) >= 500) {
    captureAppError(error, {
      operation: "http.request",
      traceId: observation.traceId,
    })
  }
}

const chatSpans = new Map<string, Sentry.Span>()

export function startChatRound(traceId: string, conversationId: string) {
  if (!monitoringEnabled || chatSpans.has(traceId)) return
  chatSpans.set(
    traceId,
    Sentry.startInactiveSpan({
      name: "chat round",
      op: "chat.websocket",
      attributes: {
        trace_id: traceId,
        conversation_id: conversationId,
      },
    }),
  )
}

export function finishChatRound(
  traceId: string | undefined,
  outcome: "ok" | "error",
  expressionGroupId?: string | null,
) {
  if (!traceId) return
  const span = chatSpans.get(traceId)
  if (!span) return
  span.setAttribute("outcome", outcome)
  if (expressionGroupId) {
    span.setAttribute("expression_group_id", expressionGroupId)
  }
  span.end()
  chatSpans.delete(traceId)
}

export { Sentry }
