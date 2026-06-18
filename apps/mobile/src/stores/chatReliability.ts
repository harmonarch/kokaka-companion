export type PendingOutgoingMessage<Agent = unknown> = {
  id: string
  content: string
  conversationId: string
  agents: Agent[]
}

export function upsertPendingOutgoing<Agent>(
  messages: PendingOutgoingMessage<Agent>[],
  message: PendingOutgoingMessage<Agent>,
) {
  return [...messages.filter((item) => item.id !== message.id), message]
}

export function removeConfirmedOutgoing<Agent>(
  messages: PendingOutgoingMessage<Agent>[],
  clientMessageId?: string,
) {
  if (!clientMessageId) return messages
  return messages.filter((message) => message.id !== clientMessageId)
}

export function shouldRecoverConnection(
  previous: string,
  next: string,
) {
  return (
    next === "connected" &&
    (previous === "reconnecting" || previous === "error")
  )
}
