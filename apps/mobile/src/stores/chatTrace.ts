type ChatRoundOutcome = "ok" | "error"

type ServerTraceReference = {
  trace_id?: string
  trace_ids?: string[]
}

export function finishServerChatRounds(
  message: ServerTraceReference,
  outcome: ChatRoundOutcome,
  finish: (traceId: string | undefined, outcome: ChatRoundOutcome) => void,
) {
  const traceIds = [
    ...(message.trace_id ? [message.trace_id] : []),
    ...(message.trace_ids ?? []),
  ]
  for (const traceId of new Set(traceIds)) {
    finish(traceId, outcome)
  }
}
