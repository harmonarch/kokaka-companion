import { Hono } from "hono";
import { updateMeRequestSchema } from "@ai-companion/shared";
import type { AppBindings } from "@/middleware/auth";
import { authMiddleware } from "@/middleware/auth";

export const meRoutes = new Hono<AppBindings>();

meRoutes.use("*", authMiddleware);

meRoutes.get("/", (c) => c.json(c.get("user")));

meRoutes.patch("/", async (c) => {
  const input = updateMeRequestSchema.parse(await c.req.json());
  const user = c.get("user");
  await c.env.DB.prepare("UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?")
    .bind(input.nickname, Math.floor(Date.now() / 1000), user.id)
    .run();
  return c.json({
    ...user,
    nickname: input.nickname
  });
});
