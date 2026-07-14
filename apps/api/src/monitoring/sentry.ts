import * as Sentry from "@sentry/cloudflare"
import type { Env } from "@/env"

type ErrorContext = {
  traceId?: string
  conversationId?: string
  expressionGroupId?: string
  userId?: string
  operation?: string
  path?: string
}

function configured(env: Env) {
  return Boolean(env.SENTRY_DSN)
}

function finiteRate(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback
}

export function resolveTraceId(value: string | undefined) {
  const candidate = value?.trim()
  return candidate && /^[a-zA-Z0-9._:-]{1,128}$/.test(candidate)
    ? candidate
    : crypto.randomUUID()
}

export function sentryOptions(env: Env) {
  return {
    dsn: env.SENTRY_DSN,
    enabled: configured(env),
    environment: env.SENTRY_ENVIRONMENT ?? "development",
    release: env.SENTRY_RELEASE,
    tracesSampleRate: finiteRate(env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    sendDefaultPii: false,
    beforeSend(event: Sentry.ErrorEvent) {
      if (event.request) {
        if (event.request.url) {
          event.request.url = event.request.url.split("?")[0]
        }
        delete event.request.cookies
        delete event.request.data
        delete event.request.headers
        delete event.request.query_string
      }
      event.user = event.user?.id ? { id: event.user.id } : undefined
      return event
    },
  }
}

export function captureException(
  env: Env,
  error: unknown,
  context: ErrorContext = {},
) {
  if (!configured(env)) return

  Sentry.withScope((scope) => {
    if (context.traceId) scope.setTag("trace_id", context.traceId)
    if (context.conversationId) {
      scope.setTag("conversation_id", context.conversationId)
    }
    if (context.expressionGroupId) {
      scope.setTag("expression_group_id", context.expressionGroupId)
    }
    if (context.operation) scope.setTag("operation", context.operation)
    if (context.path) scope.setTag("request_path", context.path)
    if (context.userId) scope.setUser({ id: context.userId })
    Sentry.captureException(error)
  })
}

export function monitorOperation<T>(
  env: Env,
  name: string,
  context: ErrorContext,
  operation: () => Promise<T>,
) {
  if (!configured(env)) return operation()

  return Sentry.startSpan(
    {
      name,
      op: name,
      attributes: {
        trace_id: context.traceId,
        conversation_id: context.conversationId,
        expression_group_id: context.expressionGroupId,
      },
    },
    operation,
  )
}

export function monitoredTask(
  env: Env,
  task: Promise<unknown>,
  context: ErrorContext,
) {
  return task.catch((error) => {
    captureException(env, error, context)
    throw error
  })
}
