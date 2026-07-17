export type Env = {
  DB: D1Database
  CHAT_CONTEXT: KVNamespace
  MEMORY_VECTORIZE?: VectorizeIndex
  JWT_SECRET: string
  ACCESS_TOKEN_TTL_SECONDS: string
  REFRESH_TOKEN_TTL_SECONDS: string
  PASSWORD_HASH_SECRET: string
  LLM_PROVIDER: "deepseek"
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_BASE_URL: string
  DEEPSEEK_MODEL: string
  EMBEDDING_BASE_URL?: string
  EMBEDDING_MODEL?: string
  EMBEDDING_API_KEY?: string
  SENTRY_DSN?: string
  SENTRY_ENVIRONMENT?: string
  SENTRY_RELEASE?: string
  SENTRY_TRACES_SAMPLE_RATE?: string
  LANGSMITH_TRACING?: string
  LANGSMITH_ENDPOINT?: string
  LANGSMITH_API_KEY?: string
  LANGSMITH_PROJECT?: string
  TOKEN_ALERT_HARD_LIMIT?: string
  MONITORING_API_KEY?: string
}

const required = [
  "JWT_SECRET",
  "ACCESS_TOKEN_TTL_SECONDS",
  "REFRESH_TOKEN_TTL_SECONDS",
  "PASSWORD_HASH_SECRET",
  "LLM_PROVIDER",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
] as const

export function assertEnv(env: Env) {
  const missing = required.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`)
  }
}

export function ttlSeconds(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
