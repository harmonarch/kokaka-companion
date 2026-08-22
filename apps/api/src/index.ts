import { Hono } from "hono"
import { cors } from "hono/cors"
import type { AppBindings } from "@/middleware/auth"
import { errorMiddleware } from "@/middleware/error"
import { assertEnv, type Env } from "@/env"
import { authRoutes } from "@/routes/auth"
import { meRoutes } from "@/routes/me"
import { accountRoutes } from "@/routes/account"
import { chatRoutes } from "@/routes/chat"
import { memoryRoutes } from "@/routes/memories"
import { profileRoutes } from "@/routes/profiles"
import { monitoringRoutes } from "@/routes/monitoring"
import { audioRoutes } from "@/routes/audio"
import { wsRoutes } from "@/routes/ws"
import { handleChatWebSocket } from "@/ws/chat"
import { withSentry } from "@sentry/cloudflare"
import { resolveTraceId, sentryOptions } from "@/monitoring/sentry"

const app = new Hono<AppBindings>()

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type", "x-trace-id"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["x-trace-id"],
  }),
)

app.use("*", async (c, next) => {
  const traceId = resolveTraceId(c.req.header("x-trace-id"))
  c.set("traceId", traceId)
  c.header("x-trace-id", traceId)
  await next()
})

app.use("*", errorMiddleware)

app.use("*", async (c, next) => {
  assertEnv(c.env)
  await next()
})

app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first()
  return c.json({ ok: true })
})

app.route("/auth", authRoutes)
app.route("/me", meRoutes)
app.route("/account", accountRoutes)
app.route("/chat", chatRoutes)
app.route("/memories", memoryRoutes)
app.route("/profiles", profileRoutes)
app.route("/monitoring", monitoringRoutes)
app.route("/audio", audioRoutes)
app.route("/ws", wsRoutes)

app.get("/ws/chat", (c) =>
  handleChatWebSocket(c.req.raw, c.env, c.executionCtx, c.get("traceId")),
)

export default withSentry((env) => sentryOptions(env as Env), app)
