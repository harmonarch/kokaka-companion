import { Hono } from "hono"
import { cors } from "hono/cors"
import type { AppBindings } from "@/middleware/auth"
import { errorMiddleware } from "@/middleware/error"
import { assertEnv } from "@/env"
import { authRoutes } from "@/routes/auth"
import { meRoutes } from "@/routes/me"
import { accountRoutes } from "@/routes/account"
import { chatRoutes } from "@/routes/chat"
import { handleChatWebSocket } from "@/ws/chat"

const app = new Hono<AppBindings>()

app.use("*", errorMiddleware)
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
)

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

app.get("/ws/chat", (c) =>
  handleChatWebSocket(c.req.raw, c.env, c.executionCtx),
)

export default app
