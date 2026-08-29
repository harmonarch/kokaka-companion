import { describe, expect, it } from "vitest"
import { cleanupExpiredData } from "@/maintenance/cleanup"
import type { Env } from "@/env"

const OBSERVATION_RETENTION_SECONDS = 30 * 24 * 3600

describe("cleanupExpiredData", () => {
  it("deletes expired refresh tokens and observations past retention", async () => {
    const runs: Array<{ sql: string; args: unknown[] }> = []
    let batchedStatements = 0
    const db = {
      prepare(sql: string) {
        const statement = {
          args: [] as unknown[],
          bind(...args: unknown[]) {
            statement.args = args
            runs.push({ sql, args: [...statement.args] })
            return statement
          },
          run() {
            return Promise.resolve({ success: true })
          },
        }
        return statement
      },
      async batch(statements: unknown[]) {
        batchedStatements = statements.length
        return statements.map(() => ({ success: true }))
      },
    }

    await cleanupExpiredData({ DB: db } as unknown as Env)

    expect(runs.map((run) => run.sql)).toEqual([
      "DELETE FROM refresh_tokens WHERE expires_at < ?",
      "DELETE FROM conversation_observation_events WHERE occurred_at < ?",
      "DELETE FROM conversation_observations WHERE started_at < ?",
    ])
    const [tokenCutoff, eventCutoff, observationCutoff] = runs.map(
      (run) => run.args[0],
    ) as Array<number>
    expect(tokenCutoff).toBeGreaterThan(Date.now() / 1000 - 60)
    expect(eventCutoff).toBeCloseTo(
      tokenCutoff - OBSERVATION_RETENTION_SECONDS,
      -1,
    )
    expect(observationCutoff).toBe(eventCutoff)
    expect(batchedStatements).toBe(2)
  })
})
