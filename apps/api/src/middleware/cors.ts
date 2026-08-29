import { cors } from "hono/cors"
import type { MiddlewareHandler } from "hono"
import type { AppBindings } from "@/middleware/auth"

// 浏览器来源白名单：逗号分隔的环境变量。未配置或留空时返回 null，
// 表示允许任意来源，与本地开发和既有部署的默认行为一致。
export function resolveAllowedOrigins(value: string | undefined) {
  const origins = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  return origins && origins.length > 0 ? origins : null
}

// 无 Origin 头的请求（非浏览器）传空串，返回 null 时不带跨域头。
export function resolveCorsOrigin(allowed: string[] | null, origin: string) {
  if (!allowed) return origin || "*"
  return allowed.includes(origin) ? origin : null
}

export function createCorsMiddleware(): MiddlewareHandler<AppBindings> {
  return cors({
    origin: (origin, c) =>
      resolveCorsOrigin(
        resolveAllowedOrigins(c.env.CORS_ALLOWED_ORIGINS),
        origin,
      ),
    allowHeaders: ["authorization", "content-type", "x-trace-id"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["x-trace-id"],
  })
}
