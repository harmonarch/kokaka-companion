import { clientWsMessageSchema } from "@ai-companion/shared"
import type { ChatMessage, RecentContext } from "@ai-companion/shared"
import type { Env } from "@/env"
import { findUserById } from "@/auth/session"
import { verifyAccessToken } from "@/auth/tokens"
import { runAgent } from "@/agent/graph"
import { replaceChatMessages } from "@/chat/history"
import {
  extractLongTermMemory,
  maybeSaveConversationSummary,
  saveLongTermMemory,
} from "@/agent/memory/longTermMemory"
import { LLMEvaluator } from "@/ws/collector/llm-evaluator"
import { MessageCollector } from "@/ws/collector/message-collector"
import type { PendingMessage } from "@/ws/collector/types"

function send(socket: WebSocket, payload: unknown) {
  socket.send(JSON.stringify(payload))
}

function chunks(value: string) {
  const parts = value.match(/.{1,16}/gs)
  return parts && parts.length > 0 ? parts : [value]
}

export function isShortMessageBurst(messages: PendingMessage[]) {
  return (
    messages.length >= 2 &&
    messages.every((message) => message.content.trim().length <= 20)
  )
}

function limitReplyParts(parts: string[]) {
  return parts
    .slice(0, 3)
    .concat(parts.length > 4 ? [parts.slice(3).join("")] : parts.slice(3))
}

export function splitReplyIntoParts(reply: string) {
  const normalized = reply.trim()
  if (!normalized) return [reply]

  const parts =
    normalized
      .match(/[^。！？!?…\n]+[。！？!?…]?/g)
      ?.map((part) => part.trim()) ?? []
  const filtered = parts.filter(Boolean)
  if (filtered.length > 1) return limitReplyParts(filtered)

  const spaced = normalized.split(/\s+/).filter(Boolean)
  if (spaced.length > 1) return limitReplyParts(spaced)

  return [normalized]
}

export function buildReplyParts(reply: string, shouldSplit: boolean) {
  const parts = shouldSplit ? splitReplyIntoParts(reply) : [reply]
  return parts.slice(0, 4).map((content, index) => ({
    id: crypto.randomUUID(),
    content,
    index,
    total: Math.min(parts.length, 4),
  }))
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForMinimumReplyingTime(replyingStartedAt: number) {
  const elapsed = Date.now() - replyingStartedAt
  const remaining = 3000 - elapsed
  if (remaining > 0) await wait(remaining)
}

export async function updateCollectedHistory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    expressionGroupId: string
    syntheticUserMessageId: string
    pending: PendingMessage[]
    reply: string
    replyParts: Array<{
      id: string
      content: string
      index: number
      total: number
    }>
    context: ChatMessage[] | undefined
  },
): Promise<ChatMessage[]> {
  const currentAgentMessage = [...(input.context ?? [])]
    .reverse()
    .find((message) => message.role === "agent")
  const agentCreatedAt = currentAgentMessage?.created_at ?? Date.now()
  const agentMessages = input.replyParts.map(
    (part): ChatMessage => ({
      id: part.id,
      role: "agent",
      content: part.content,
      created_at: agentCreatedAt + part.index,
      expression_group_id: input.expressionGroupId,
      expression_part_index: part.index,
    }),
  )
  const userMessages = input.pending.map(
    (message, index): ChatMessage => ({
      id: message.id,
      role: "user",
      content: message.content,
      created_at: message.receivedAt,
      expression_group_id: input.expressionGroupId,
      expression_part_index: index,
    }),
  )
  const deleteIds = [
    input.syntheticUserMessageId,
    ...(currentAgentMessage ? [currentAgentMessage.id] : []),
    ...(input.context ?? [])
      .filter(
        (message) =>
          message.role === "agent" &&
          message.expression_group_id === input.expressionGroupId,
      )
      .map((message) => message.id),
  ]

  await replaceChatMessages(env, {
    userId: input.userId,
    conversationId: input.conversationId,
    deleteIds,
    messages: [...userMessages, ...agentMessages],
  }).catch((error) => {
    console.error("Failed to replace collected chat history", error)
  })

  const currentContext = (input.context ?? []).filter(
    (message) => !deleteIds.includes(message.id),
  )
  const messages = [...currentContext, ...userMessages, ...agentMessages].slice(
    -20,
  )
  const recentContext: RecentContext = { messages }
  await env.CHAT_CONTEXT.put(
    `ctx:${input.userId}`,
    JSON.stringify(recentContext),
    {
      expirationTtl: 60 * 60 * 6,
    },
  ).catch((error) => {
    console.error("Failed to replace collected recent context", error)
  })
  return messages
}

export async function handleChatWebSocket(
  request: Request,
  env: Env,
  executionCtx?: ExecutionContext,
) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token) {
    return new Response("Unauthorized", { status: 401 })
  }
  const payload = await verifyAccessToken(token, env)
  const user = payload ? await findUserById(env, payload.sub) : null
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  server.accept()

  const collector = new MessageCollector(
    {
      responseTimeoutMs: 5000,
      nudgeTimeoutMs: 10000,
      gentleTimeoutMs: 20000,
      evalIntervalMs: 1000,
    },
    {
      onStatus: (status) => {
        send(server, {
          type: "agent_status",
          status,
        })
      },
      onSubmit: async ({
        pending,
        expressionGroupId,
        gentle,
        replyingStartedAt,
      }) => {
        const content = pending.map((message) => message.content).join("\n")
        const shortMessageBurst = isShortMessageBurst(pending)
        const syntheticUserMessageId = `${expressionGroupId}:combined`
        const conversationId = pending[0]?.sessionId ?? "default"

        if (!gentle) {
          send(server, {
            type: "topic_start",
            topic_id: "default",
            label: "当前消息",
            index: 1,
            total: 1,
          })
        }

        const result = await runAgent(env, {
          userId: user.id,
          message: content,
          conversationId,
          userMessageId: syntheticUserMessageId,
          shortMessageBurst,
        })
        const replyParts = buildReplyParts(
          result.reply,
          shortMessageBurst && !gentle && result.emotionState !== "crisis",
        )

        await waitForMinimumReplyingTime(replyingStartedAt)

        if (gentle) {
          send(server, {
            type: "gentle",
            content: result.reply,
          })
          send(server, {
            type: "all_done",
            metadata: {
              emotion_state: result.emotionState,
              topics_count: 1,
            },
          })
        } else {
          for (const part of replyParts) {
            for (const delta of chunks(part.content)) {
              send(server, {
                type: "token",
                topic_id: "default",
                delta,
                message_id: part.id,
                expression_group_id: expressionGroupId,
                expression_part_index: part.index,
                expression_part_total: part.total,
              })
            }
          }
          send(server, {
            type: "topic_done",
            topic_id: "default",
          })
          send(server, {
            type: "all_done",
            metadata: {
              emotion_state: result.emotionState,
              topics_count: 1,
            },
          })
        }

        const collectedContext = await updateCollectedHistory(env, {
          userId: user.id,
          conversationId: result.conversationId,
          expressionGroupId,
          syntheticUserMessageId,
          pending,
          reply: result.reply,
          replyParts,
          context: result.context,
        })

        const persistLongTermMemory = async () => {
          const memory = await extractLongTermMemory(env, {
            userMessage: content,
            reply: result.reply,
            emotionState: result.emotionState,
            context: collectedContext,
          })
          await saveLongTermMemory(env, {
            userId: user.id,
            conversationId: result.conversationId,
            memory,
          })
          await maybeSaveConversationSummary(env, {
            userId: user.id,
            conversationId: result.conversationId,
            messages: collectedContext,
          })
        }
        if (executionCtx) {
          executionCtx.waitUntil(persistLongTermMemory())
        } else {
          await persistLongTermMemory()
        }
      },
      onNudge: (text) => {
        send(server, {
          type: "nudge",
          content: text,
        })
      },
      onError: (error) => {
        send(server, {
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed",
        })
      },
    },
    new LLMEvaluator(env),
  )

  server.addEventListener("message", async (event) => {
    try {
      const message = clientWsMessageSchema.parse(
        JSON.parse(String(event.data)),
      )
      if (message.type === "ping") {
        send(server, { type: "pong" })
        return
      }

      if (message.type === "done") {
        await collector.forceDone()
        return
      }

      send(server, {
        type: "agent_status",
        status: "received",
      })
      collector.addMessage({
        id: message.client_message_id,
        sessionId: message.session_id,
        content: message.content,
      })
    } catch (error) {
      send(server, {
        type: "error",
        message: error instanceof Error ? error.message : "Chat failed",
      })
    }
  })
  server.addEventListener("close", () => collector.dispose())
  server.addEventListener("error", () => collector.dispose())

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}
