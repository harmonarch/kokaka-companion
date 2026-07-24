import assert from "node:assert/strict"
import test from "node:test"
import { finishServerChatRounds } from "./chatTrace"

test("finishes every trace included in a merged chat round", () => {
  const finished: Array<{ traceId: string | undefined; outcome: string }> = []

  finishServerChatRounds(
    {
      trace_id: "trace-1",
      trace_ids: ["trace-1", "trace-2", "trace-3"],
    },
    "ok",
    (traceId, outcome) => finished.push({ traceId, outcome }),
  )

  assert.deepEqual(finished, [
    { traceId: "trace-1", outcome: "ok" },
    { traceId: "trace-2", outcome: "ok" },
    { traceId: "trace-3", outcome: "ok" },
  ])
})

test("keeps finishing legacy single-trace chat rounds", () => {
  const finished: string[] = []

  finishServerChatRounds({ trace_id: "trace-legacy" }, "error", (traceId) => {
    if (traceId) finished.push(traceId)
  })

  assert.deepEqual(finished, ["trace-legacy"])
})

test("includes the primary trace once when trace_ids omit or repeat it", () => {
  const finished: string[] = []

  finishServerChatRounds(
    {
      trace_id: "trace-primary",
      trace_ids: ["trace-secondary", "trace-secondary"],
    },
    "ok",
    (traceId) => {
      if (traceId) finished.push(traceId)
    },
  )

  assert.deepEqual(finished, ["trace-primary", "trace-secondary"])
})
