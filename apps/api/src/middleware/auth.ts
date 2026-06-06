import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "@/env";
import { authenticateRequest, type AppUser } from "@/auth/session";

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: AppUser;
  };
};

export const authMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await authenticateRequest(c.env, c.req.raw);
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  c.set("user", user);
  await next();
};
