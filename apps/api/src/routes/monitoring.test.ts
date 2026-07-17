import { describe, expect, it } from "vitest"
import { monitoringRoutes } from "./monitoring"
import type { Env } from "@/env"

function createEnv() {
  const calls: Array<{ sql: string; values: unknown[] }> = []
  const env = {
    MONITORING_API_KEY: "dashboard-secret",
    DB: {
      prepare(sql: string) {
        const call = { sql, values: [] as unknown[] }
        calls.push(call)
        return {
          bind(...values: unknown[]) {
            call.values = values
            return this
          },
          all: async () => ({ results: [] }),
          first: async () => ({
            totalTraces: 0,
            healthyTraces: 0,
            unhealthyTraces: 0,
            activeTraces: 0,
            averageFirstResponseMs: null,
            averageDurationMs: null,
            totalTokens: 0,
            totalModelCalls: 0,
            storageFailureCount: 0,
          }),
        }
      },
    },
  } as unknown as Env
  return { env, calls }
}

describe("monitoring routes", () => {
  it("rejects requests without the monitoring key", async () => {
    const { env } = createEnv()
    const response = await monitoringRoutes.request(
      "/overview?from=1&to=2",
      {},
      env,
    )

    expect(response.status).toBe(401)
  })

  it("queries only the requested user and time range", async () => {
    const { env, calls } = createEnv()
    const response = await monitoringRoutes.request(
      "/overview?from=100&to=200&userId=user-1&status=failed",
      { headers: { "x-monitoring-key": "dashboard-secret" } },
      env,
    )

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(3)
    expect(calls[0]?.values).toEqual([100, 200, "user-1", "failed", 100])
    expect(calls[1]?.values).toEqual([100, 200, "user-1", "failed"])
  })

  it("rejects an inverted time range", async () => {
    const { env } = createEnv()
    const response = await monitoringRoutes.request(
      "/overview?from=200&to=100",
      { headers: { "x-monitoring-key": "dashboard-secret" } },
      env,
    )

    expect(response.status).toBe(400)
  })
})
