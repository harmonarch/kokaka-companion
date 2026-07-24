import type { ChatMessage, ServerWsMessage } from "@ai-companion/shared"

const transientNudgePrefix = "transient-nudge:"

export function isTransientNudge(message: ChatMessage) {
  return message.id.startsWith(transientNudgePrefix)
}

export function createTransientNudgeId(id: string) {
  return `${transientNudgePrefix}${id}`
}

export function applyTokenMessage(
  current: ChatMessage[],
  message: Extract<ServerWsMessage, { type: "token" }>,
  input: {
    id: () => string
    now: () => number
  },
) {
  const messages = [...current]
  const targetId = message.message_id ?? messages[0]?.id
  const targetIndex = targetId
    ? messages.findIndex((item) => item.id === targetId)
    : -1

  if (targetIndex >= 0) {
    messages[targetIndex] = {
      ...messages[targetIndex],
      content: messages[targetIndex].content + message.delta,
    }
  } else if (message.message_id) {
    messages.unshift({
      id: message.message_id,
      role: "agent",
      agent_id: message.agent_id,
      agent_name: message.agent_name,
      content: message.delta,
      created_at: input.now() + (message.expression_part_index ?? 0),
      expression_group_id: message.expression_group_id,
      expression_part_index: message.expression_part_index,
    })
  } else {
    const newest = messages[0]
    if (newest?.role === "agent" && !isTransientNudge(newest)) {
      newest.content += message.delta
    } else {
      messages.unshift({
        id: input.id(),
        role: "agent",
        agent_id: message.agent_id,
        agent_name: message.agent_name,
        content: message.delta,
        created_at: input.now(),
      })
    }
  }

  return messages.sort((a, b) => {
    if (a.created_at !== b.created_at) return b.created_at - a.created_at
    if (a.role !== b.role) return a.role === "agent" ? -1 : 1
    return 0
  })
}
