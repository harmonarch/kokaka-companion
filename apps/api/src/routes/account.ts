import { Hono } from "hono";
import type { AppBindings } from "@/middleware/auth";
import { authMiddleware } from "@/middleware/auth";

export const accountRoutes = new Hono<AppBindings>();

async function deleteLongTermMemory(env: AppBindings["Bindings"], userId: string) {
  await env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM memories WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM conversation_summaries WHERE user_id = ?")
    .bind(userId)
    .run();
}

accountRoutes.delete("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    "UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(now, now, user.id)
    .run();
  await c.env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL"
  )
    .bind(now, user.id)
    .run();
  await c.env.CHAT_CONTEXT.delete(`ctx:${user.id}`);
  await c.env.CHAT_CONTEXT.delete(`mood:${user.id}`);
  await deleteLongTermMemory(c.env, user.id);
  return c.json({ ok: true });
});
