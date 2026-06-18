export type PendingOutgoingMessage<Agent = unknown> = {
  id: string
  content: string
  conversationId: string
  agents: Agent[]
  createdAt: number
}

export type PendingUserMessage = {
  id: string
  role: "user"
  content: string
  created_at: number
}

export type PendingOutgoingStorage = {
  loadJson: <T>(key: string) => Promise<T | null>
  saveJson: <T>(key: string, value: T | null) => Promise<void>
}

export const pendingOutgoingKey = "kokaka.chat.pendingOutgoing"

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

export async function loadPendingOutgoing<Agent>(
  storage: PendingOutgoingStorage,
) {
  return (
    (await storage.loadJson<PendingOutgoingMessage<Agent>[]>(
      pendingOutgoingKey,
    )) ?? []
  )
}

export async function savePendingOutgoing<Agent>(
  storage: PendingOutgoingStorage,
  messages: PendingOutgoingMessage<Agent>[],
) {
  await storage.saveJson(pendingOutgoingKey, messages.length ? messages : null)
}

export async function clearPendingOutgoing(storage: PendingOutgoingStorage) {
  await storage.saveJson(pendingOutgoingKey, null)
}

export function toPendingUserMessages<Agent>(
  pending: PendingOutgoingMessage<Agent>[],
  conversationId?: string,
): PendingUserMessage[] {
  return pending
    .filter(
      (message) => !conversationId || message.conversationId === conversationId,
    )
    .map((message) => ({
      id: message.id,
      role: "user",
      content: message.content,
      created_at: message.createdAt,
    }))
}
