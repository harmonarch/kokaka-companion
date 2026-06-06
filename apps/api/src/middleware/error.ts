import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export const errorMiddleware: MiddlewareHandler = async (_c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    if (error instanceof ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.flatten() }),
        {
          status: 400,
          headers: { "content-type": "application/json" }
        }
      );
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" }
      }
    );
  }
};
