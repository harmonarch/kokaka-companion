import { Hono } from "hono"
import type { AppBindings } from "@/middleware/auth"
import { authMiddleware } from "@/middleware/auth"
import { createWsTicket } from "@/ws/ticket"

export const wsRoutes = new Hono<AppBindings>()

wsRoutes.post("/ticket", authMiddleware, async (c) => {
  const ticket = await createWsTicket(c.env, c.get("user").id)
  return c.json({ ticket })
})
