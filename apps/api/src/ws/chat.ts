import { clientWsMessageSchema } from "@ai-companion/shared"
import type { ChatMessage, RecentContext } from "@ai-companion/shared"
import type { Env } from "@/env"
import { findUserById } from "@/auth/session"
import { verifyAccessToken } from "@/auth/tokens"
import { runAgent } from "@/agent/graph"
import { replaceChatMessages, saveChatMessages } from "@/chat/history"
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

function trySend(socket: WebSocket, payload: unknown) {
  try {
    send(socket, payload)
    return true
  } catch {
    return false
  }
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

export function trimReplyPartEnding(content: string) {
  return content.replace(/[。.]$/u, "")
}

export function buildReplyParts(reply: string, shouldSplit: boolean) {
  const parts = shouldSplit ? splitReplyIntoParts(reply) : [reply]
  return parts.slice(0, 4).map((content, index) => ({
    id: crypto.randomUUID(),
    content: trimReplyPartEnding(content),
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

export function replyPartDelayMs(content: string) {
  return Math.min(2000 + Array.from(content).length * 200, 5000)
}

function toCollectedMessages(input: {
  expressionGroupId: string
  pending: PendingMessage[]
  replyParts: Array<{
    id: string
    content: string
    index: number
    total: number
  }>
  context: ChatMessage[] | undefined
}) {
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
  return { userMessages, agentMessages }
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
  const { userMessages, agentMessages } = toCollectedMessages(input)
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

export async function appendCollectedHistory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    expressionGroupId: string
    pending: PendingMessage[]
    replyParts: Array<{
      id: string
      content: string
      index: number
      total: number
    }>
    context: ChatMessage[] | undefined
  },
): Promise<ChatMessage[]> {
  const { userMessages, agentMessages } = toCollectedMessages(input)
  await saveChatMessages(env, {
    userId: input.userId,
    conversationId: input.conversationId,
    messages: [...userMessages, ...agentMessages],
  }).catch((error) => {
    console.error("Failed to append collected chat history", error)
  })

  const currentContext = (input.context ?? []).filter(
    (message) =>
      !userMessages.some((item) => item.id === message.id) &&
      !agentMessages.some((item) => item.id === message.id),
  )
  const contextIds = new Set((input.context ?? []).map((message) => message.id))
  const existingIds = new Set([
    ...contextIds,
    ...currentContext.map((message) => message.id),
  ])
  const messages = [
    ...currentContext,
    ...userMessages.filter((message) => !existingIds.has(message.id)),
    ...agentMessages.filter((message) => !existingIds.has(message.id)),
  ].slice(-20)
  const recentContext: RecentContext = { messages }
  await env.CHAT_CONTEXT.put(
    `ctx:${input.userId}`,
    JSON.stringify(recentContext),
    {
      expirationTtl: 60 * 60 * 6,
    },
  ).catch((error) => {
    console.error("Failed to append collected recent context", error)
  })
  return messages
}

export async function persistVisibleReplyParts(
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
    replaceSynthetic: boolean
  },
) {
  if (input.replaceSynthetic) {
    return updateCollectedHistory(env, input)
  }
  return appendCollectedHistory(env, input)
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
  let connectionOpen = true
  let replyGeneration = 0

  const collector = new MessageCollector(
    {
      responseTimeoutMs: 5000,
      nudgeTimeoutMs: 10000,
      gentleTimeoutMs: 20000,
      evalIntervalMs: 1000,
    },
    {
      onStatus: (status) => {
        trySend(server, {
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
        const currentReplyGeneration = replyGeneration

        if (!gentle) {
          trySend(server, {
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
          trySend(server, {
            type: "gentle",
            content: result.reply,
          })
          trySend(server, {
            type: "all_done",
            metadata: {
              emotion_state: result.emotionState,
              relationship_state: result.relationshipState,
              topics_count: 1,
            },
          })
        } else {
          let collectedContext = result.context
          let replaceSynthetic = true
          const deliveredReplyParts: typeof replyParts = []
          let interrupted = false

          for (const [partIndex, part] of replyParts.entries()) {
            if (replyGeneration !== currentReplyGeneration) {
              interrupted = true
              if (replaceSynthetic) {
                collectedContext = await persistVisibleReplyParts(env, {
                  userId: user.id,
                  conversationId: result.conversationId,
                  expressionGroupId,
                  syntheticUserMessageId,
                  pending,
                  reply: result.reply,
                  replyParts: [],
                  context: collectedContext,
                  replaceSynthetic,
                })
                replaceSynthetic = false
              }
              break
            }

            if (!connectionOpen) {
              collectedContext = await persistVisibleReplyParts(env, {
                userId: user.id,
                conversationId: result.conversationId,
                expressionGroupId,
                syntheticUserMessageId,
                pending,
                reply: result.reply,
                replyParts,
                context: collectedContext,
                replaceSynthetic,
              })
              replaceSynthetic = false
              break
            }

            let sent = true
            for (const delta of chunks(part.content)) {
              sent =
                trySend(server, {
                  type: "token",
                  topic_id: "default",
                  delta,
                  message_id: part.id,
                  expression_group_id: expressionGroupId,
                  expression_part_index: part.index,
                  expression_part_total: part.total,
                }) && sent
              if (!sent) {
                connectionOpen = false
                break
              }
            }

            if (!sent) {
              collectedContext = await persistVisibleReplyParts(env, {
                userId: user.id,
                conversationId: result.conversationId,
                expressionGroupId,
                syntheticUserMessageId,
                pending,
                reply: result.reply,
                replyParts,
                context: collectedContext,
                replaceSynthetic,
              })
              replaceSynthetic = false
              break
            }

            deliveredReplyParts.push(part)
            collectedContext = await persistVisibleReplyParts(env, {
              userId: user.id,
              conversationId: result.conversationId,
              expressionGroupId,
              syntheticUserMessageId,
              pending,
              reply: result.reply,
              replyParts: deliveredReplyParts,
              context: collectedContext,
              replaceSynthetic,
            })
            replaceSynthetic = false

            if (partIndex < replyParts.length - 1) {
              await wait(replyPartDelayMs(part.content))
            }
          }

          if (
            connectionOpen &&
            replyGeneration === currentReplyGeneration &&
            deliveredReplyParts.length === replyParts.length
          ) {
            trySend(server, {
              type: "topic_done",
              topic_id: "default",
            })
            trySend(server, {
              type: "all_done",
              metadata: {
                emotion_state: result.emotionState,
                relationship_state: result.relationshipState,
                topics_count: 1,
              },
            })
          }

          const persistLongTermMemory = async () => {
            const visibleReply = interrupted
              ? deliveredReplyParts.map((part) => part.content).join("")
              : result.reply
            if (!visibleReply) return
            const memory = await extractLongTermMemory(env, {
              userMessage: content,
              reply: visibleReply,
              emotionState: result.emotionState,
              relationshipSnapshot: result.relationshipSnapshot,
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
          return
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
            relationshipSnapshot: result.relationshipSnapshot,
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
        trySend(server, {
          type: "nudge",
          content: text,
        })
      },
      onError: (error) => {
        trySend(server, {
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed",
        })
      },
    },
    new LLMEvaluator(env),
  )

  server.addEventListener("message", async (event) => {
    try {
      connectionOpen = true
      const message = clientWsMessageSchema.parse(
        JSON.parse(String(event.data)),
      )
      if (message.type === "ping") {
        trySend(server, { type: "pong" })
        return
      }

      if (message.type === "done") {
        replyGeneration += 1
        await collector.forceDone()
        return
      }

      replyGeneration += 1
      trySend(server, {
        type: "agent_status",
        status: "received",
      })
      collector.addMessage({
        id: message.client_message_id,
        sessionId: message.session_id,
        content: message.content,
      })
    } catch (error) {
      trySend(server, {
        type: "error",
        message: error instanceof Error ? error.message : "Chat failed",
      })
    }
  })
  server.addEventListener("close", () => {
    connectionOpen = false
    void collector.forceDone().catch((error) => {
      console.error("Failed to finish disconnected chat reply", error)
    })
  })
  server.addEventListener("error", () => {
    connectionOpen = false
    void collector.forceDone().catch((error) => {
      console.error("Failed to finish errored chat reply", error)
    })
  })

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}
