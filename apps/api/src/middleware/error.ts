import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { ZodError } from "zod"
import type { AppBindings } from "@/middleware/auth"
import { captureException } from "@/monitoring/sentry"

export const errorMiddleware: MiddlewareHandler<AppBindings> = async (
  c,
  next,
) => {
  try {
    await next()
  } catch (error) {
    if (error instanceof HTTPException) {
      const response = error.getResponse()
      response.headers.set("x-trace-id", c.get("traceId"))
      return response
    }
    if (error instanceof ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.flatten() }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
            "x-trace-id": c.get("traceId"),
          },
        },
      )
    }
    captureException(c.env, error, {
      traceId: c.get("traceId"),
      operation: "http.request",
      path: c.req.path,
    })
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
          "x-trace-id": c.get("traceId"),
        },
      },
    )
  }
}
