import type { Env } from "@/env"

const TICKET_TTL_SECONDS = 60

function ticketKey(ticket: string) {
  return `ticket:${ticket}`
}

export async function createWsTicket(env: Env, userId: string) {
  const ticket = crypto.randomUUID()
  await env.CHAT_CONTEXT.put(ticketKey(ticket), userId, {
    expirationTtl: TICKET_TTL_SECONDS,
  })
  return ticket
}

// 一次性使用：读取后立即删除。KV 的 get+delete 非原子，极端并发下同一
// ticket 可能被两个升级短暂同时读到；配合 60s TTL，影响可控。
export async function consumeWsTicket(env: Env, ticket: string) {
  const userId = await env.CHAT_CONTEXT.get(ticketKey(ticket))
  if (!userId) return null
  await env.CHAT_CONTEXT.delete(ticketKey(ticket))
  return userId
}
