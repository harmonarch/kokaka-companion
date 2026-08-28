import { clientWsMessageSchema } from "@ai-companion/shared"
import type {
  ChatAgentContext,
  ChatMessage,
  RecentContext,
} from "@ai-companion/shared"
import type { Env } from "@/env"
import { findUserById } from "@/auth/session"
import { consumeWsTicket } from "@/ws/ticket"
import { runAgent } from "@/agent/graph"
import {
  chatMessageExists,
  replaceChatMessages,
  saveChatMessages,
} from "@/chat/history"
import {
  extractLongTermMemory,
  maybeSaveConversationSummary,
  saveLongTermMemory,
} from "@/agent/memory/longTermMemory"
import { LLMEvaluator } from "@/ws/collector/llm-evaluator"
import { MessageCollector } from "@/ws/collector/message-collector"
import { recentContextKey } from "@/agent/nodes/persist"
import type { PendingMessage } from "@/ws/collector/types"
import type { LlmCallObservation } from "@/monitoring/llm-call"
import {
  captureException,
  monitoredTask,
  monitorOperation,
} from "@/monitoring/sentry"
import {
  appendConversationLlmCall,
  recordConversationObservationEvent,
  isTokenUsageAnomalous,
  startConversationObservation,
  updateConversationObservation,
} from "@/monitoring/conversation-ledger"

async function observeStorageWrite(
  env: Env,
  input: {
    userId: string
    traceId?: string | null
    stage: "storage.chat_d1" | "storage.context_kv" | "storage.memory"
    startedAt: number
    success: boolean
  },
) {
  if (!input.traceId) return
  await recordConversationObservationEvent(env, {
    userId: input.userId,
    traceId: input.traceId,
    stage: input.stage,
    status: input.success ? "ok" : "failed",
    durationMs: Date.now() - input.startedAt,
    errorCode: input.success ? undefined : "write_failed",
  })
  await updateConversationObservation(env, {
    userId: input.userId,
    traceId: input.traceId,
    ...(input.success
      ? {}
      : {
          status: "partial" as const,
          degradationReason: `${input.stage}_failed`,
        }),
    ...(input.stage === "storage.chat_d1"
      ? { chatStored: input.success }
      : input.stage === "storage.context_kv"
        ? { contextStored: input.success }
        : { memoryStored: input.success }),
  })
}

async function appendBackgroundLlmCalls(
  env: Env,
  input: {
    userId: string
    traceId: string
    traceIds: string[]
    calls: LlmCallObservation[]
  },
) {
  for (const call of input.calls) {
    await Promise.all(
      input.traceIds.map((traceId) =>
        appendConversationLlmCall(env, {
          userId: input.userId,
          traceId,
          call,
        }),
      ),
    )
    const totalTokens = call.usage?.totalTokens ?? 0
    if (
      totalTokens > 0 &&
      (await isTokenUsageAnomalous(env, {
        userId: input.userId,
        traceId: input.traceId,
        operation: call.operation,
        totalTokens,
      }))
    ) {
      await updateTraceObservations(env, input.userId, input.traceIds, {
        status: "degraded",
        degradationReason: `${call.operation}_token_anomaly`,
      })
    }
  }
}

async function updateTraceObservations(
  env: Env,
  userId: string,
  traceIds: string[],
  input: Omit<
    Parameters<typeof updateConversationObservation>[1],
    "traceId" | "userId"
  >,
) {
  await Promise.all(
    traceIds.map((traceId) =>
      updateConversationObservation(env, { userId, traceId, ...input }),
    ),
  )
}

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

type ReplySpeaker = Pick<ChatAgentContext, "id" | "name">

type ReplyPart = {
  id: string
  content: string
  index: number
  total: number
  agentId?: string | null
  agentName?: string | null
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

export function selectReplySpeakers(
  agents: ChatAgentContext[] | undefined,
  message: string,
): ReplySpeaker[] {
  const available =
    agents?.filter((agent) => agent.id && agent.name.trim()) ?? []
  if (available.length <= 1) {
    return available.map((agent) => ({ id: agent.id, name: agent.name }))
  }
  const named = available.filter((agent) => message.includes(agent.name))
  return (named.length ? named : available)
    .slice(0, 2)
    .map((agent) => ({ id: agent.id, name: agent.name }))
}

export function withReplySpeakers(
  parts: ReplyPart[],
  speakers: ReplySpeaker[],
): ReplyPart[] {
  if (!speakers.length) return parts
  return parts.map((part, index) => {
    const speaker = speakers[index % speakers.length]
    return {
      ...part,
      agentId: speaker.id,
      agentName: speaker.name,
    }
  })
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

export async function acknowledgeChatMessage(
  env: Env,
  input: {
    userId: string
    clientMessageId: string
    socket: WebSocket
    traceId?: string
  },
) {
  const alreadyReceived = await chatMessageExists(env, {
    userId: input.userId,
    messageId: input.clientMessageId,
  })
  trySend(input.socket, {
    type: "agent_status",
    status: "received",
    client_message_id: input.clientMessageId,
    trace_id: input.traceId,
  })
  return alreadyReceived
}

function toCollectedMessages(input: {
  expressionGroupId: string
  pending: PendingMessage[]
  replyParts: Array<{
    id: string
    content: string
    index: number
    total: number
    agentId?: string | null
    agentName?: string | null
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
      agent_id: part.agentId ?? null,
      agent_name: part.agentName ?? null,
      content: part.content,
      created_at: agentCreatedAt + part.index,
      expression_group_id: input.expressionGroupId,
      expression_part_index: part.index,
      trace_id: input.pending[0]?.traceId ?? null,
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
      trace_id: message.traceId ?? null,
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
      agentId?: string | null
      agentName?: string | null
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

  const chatWriteStartedAt = Date.now()
  try {
    await replaceChatMessages(env, {
      userId: input.userId,
      conversationId: input.conversationId,
      deleteIds,
      messages: [...userMessages, ...agentMessages],
    })
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.chat_d1",
      startedAt: chatWriteStartedAt,
      success: true,
    })
  } catch (error) {
    console.error("Failed to replace collected chat history", error)
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.chat_d1",
      startedAt: chatWriteStartedAt,
      success: false,
    })
  }

  const currentContext = (input.context ?? []).filter(
    (message) => !deleteIds.includes(message.id),
  )
  const messages = [...currentContext, ...userMessages, ...agentMessages].slice(
    -20,
  )
  const recentContext: RecentContext = { messages }
  const contextWriteStartedAt = Date.now()
  try {
    await env.CHAT_CONTEXT.put(
      recentContextKey(input.userId, input.conversationId),
      JSON.stringify(recentContext),
      { expirationTtl: 60 * 60 * 6 },
    )
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.context_kv",
      startedAt: contextWriteStartedAt,
      success: true,
    })
  } catch (error) {
    console.error("Failed to replace collected recent context", error)
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.context_kv",
      startedAt: contextWriteStartedAt,
      success: false,
    })
  }
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
      agentId?: string | null
      agentName?: string | null
    }>
    context: ChatMessage[] | undefined
  },
): Promise<ChatMessage[]> {
  const { userMessages, agentMessages } = toCollectedMessages(input)
  const chatWriteStartedAt = Date.now()
  try {
    await saveChatMessages(env, {
      userId: input.userId,
      conversationId: input.conversationId,
      messages: [...userMessages, ...agentMessages],
    })
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.chat_d1",
      startedAt: chatWriteStartedAt,
      success: true,
    })
  } catch (error) {
    console.error("Failed to append collected chat history", error)
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.chat_d1",
      startedAt: chatWriteStartedAt,
      success: false,
    })
  }

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
  const contextWriteStartedAt = Date.now()
  try {
    await env.CHAT_CONTEXT.put(
      recentContextKey(input.userId, input.conversationId),
      JSON.stringify(recentContext),
      { expirationTtl: 60 * 60 * 6 },
    )
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.context_kv",
      startedAt: contextWriteStartedAt,
      success: true,
    })
  } catch (error) {
    console.error("Failed to append collected recent context", error)
    await observeStorageWrite(env, {
      userId: input.userId,
      traceId: input.pending[0]?.traceId,
      stage: "storage.context_kv",
      startedAt: contextWriteStartedAt,
      success: false,
    })
  }
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
      agentId?: string | null
      agentName?: string | null
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
  requestTraceId?: string,
) {
  const url = new URL(request.url)
  const ticket = url.searchParams.get("ticket")
  const userId = ticket ? await consumeWsTicket(env, ticket) : null
  const user = userId ? await findUserById(env, userId) : null
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  server.accept()
  let connectionOpen = true
  let replyGeneration = 0
  const activeTraceIds = new Set<string>()

  const evaluator = new LLMEvaluator(env)
  const collector = new MessageCollector(
    {
      responseTimeoutMs: 3000,
      nudgeTimeoutMs: 10000,
      gentleTimeoutMs: 20000,
      evalIntervalMs: 1000,
    },
    {
      onStatus: (status, traceId) => {
        trySend(server, {
          type: "agent_status",
          status,
          trace_id: traceId ?? requestTraceId,
        })
      },
      onSubmit: async ({
        pending,
        expressionGroupId,
        gentle,
        replyingStartedAt,
      }) => {
        const traceId =
          pending[0]?.traceId ?? requestTraceId ?? crypto.randomUUID()
        const traceIds = [
          ...new Set(
            pending
              .map((message) => message.traceId)
              .filter((value): value is string => Boolean(value)),
          ),
        ]
        if (traceId && !traceIds.includes(traceId)) traceIds.unshift(traceId)
        const content = pending.map((message) => message.content).join("\n")
        const shortMessageBurst = isShortMessageBurst(pending)
        const syntheticUserMessageId = `${expressionGroupId}:combined`
        const conversationId = pending[0]?.sessionId ?? "default"
        const observationStartedAt = Math.min(
          ...pending.map((message) => message.receivedAt),
        )
        await Promise.all(
          traceIds.map((id) =>
            startConversationObservation(env, {
              traceId: id,
              primaryTraceId: traceId,
              userId: user.id,
              conversationId,
              expressionGroupId,
              startedAt: observationStartedAt,
            }),
          ),
        )
        const agents = [...pending]
          .reverse()
          .find((message) => message.agents?.length)?.agents
        const replySpeakers = selectReplySpeakers(agents, content)
        const replyAgents = replySpeakers.length
          ? agents?.filter((agent) =>
              replySpeakers.some((speaker) => speaker.id === agent.id),
            )
          : agents
        const currentReplyGeneration = replyGeneration

        if (!gentle) {
          trySend(server, {
            type: "topic_start",
            topic_id: "default",
            label: "当前消息",
            index: 1,
            total: 1,
            trace_id: traceId,
          })
        }

        const result = await monitorOperation(
          env,
          "chat.generate_reply",
          { traceId, conversationId, expressionGroupId },
          () =>
            runAgent(env, {
              userId: user.id,
              message: content,
              conversationId,
              userMessageId: syntheticUserMessageId,
              agents: replyAgents,
              shortMessageBurst,
              traceId,
            }),
        )
        const llmCalls = [...evaluator.drainObservations(), ...result.llmCalls]
        for (const call of llmCalls) {
          await recordConversationObservationEvent(env, {
            userId: user.id,
            traceId,
            stage: `llm.${call.operation}`,
            status: call.status === "success" ? "ok" : "degraded",
            durationMs: call.durationMs,
            provider: call.provider,
            model: call.model,
            promptTokens: call.usage?.promptTokens,
            completionTokens: call.usage?.completionTokens,
            totalTokens: call.usage?.totalTokens,
            errorCode: call.fallbackReason,
          })
        }
        const tokenUsage = llmCalls.reduce(
          (total, call) => ({
            prompt: total.prompt + (call.usage?.promptTokens ?? 0),
            completion: total.completion + (call.usage?.completionTokens ?? 0),
            total: total.total + (call.usage?.totalTokens ?? 0),
          }),
          { prompt: 0, completion: 0, total: 0 },
        )
        const degradationReason = llmCalls.find(
          (call) => call.status !== "success",
        )?.fallbackReason
        const tokenAnomaly = await isTokenUsageAnomalous(env, {
          userId: user.id,
          totalTokens: tokenUsage.total,
        })
        if (tokenAnomaly) {
          await recordConversationObservationEvent(env, {
            userId: user.id,
            traceId,
            stage: "tokens.anomaly",
            status: "degraded",
            totalTokens: tokenUsage.total,
            errorCode: "token_anomaly",
          })
        }
        const finalDegradationReason = tokenAnomaly
          ? "token_anomaly"
          : degradationReason
        const replyParts = withReplySpeakers(
          buildReplyParts(
            result.reply,
            (shortMessageBurst || (agents?.length ?? 0) > 1) &&
              !gentle &&
              result.emotionState !== "crisis",
          ),
          replySpeakers,
        )

        await waitForMinimumReplyingTime(replyingStartedAt)
        const firstResponseMs = Date.now() - observationStartedAt

        if (gentle) {
          trySend(server, {
            type: "gentle",
            content: result.reply,
            agent_id: replyParts[0]?.agentId,
            agent_name: replyParts[0]?.agentName,
            trace_id: traceId,
          })
          await updateTraceObservations(env, user.id, traceIds, {
            status: finalDegradationReason ? "degraded" : "ok",
            degradationReason: finalDegradationReason,
            firstResponseMs,
            totalDurationMs: Date.now() - observationStartedAt,
            promptTokens: tokenUsage.prompt,
            completionTokens: tokenUsage.completion,
            totalTokens: tokenUsage.total,
            modelCallCount: llmCalls.length,
          })
          traceIds.forEach((id) => activeTraceIds.delete(id))
          trySend(server, {
            type: "all_done",
            metadata: {
              emotion_state: result.emotionState,
              relationship_state: result.relationshipState,
              topics_count: 1,
            },
            trace_id: traceId,
            trace_ids: traceIds,
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
                  agent_id: part.agentId,
                  agent_name: part.agentName,
                  expression_group_id: expressionGroupId,
                  expression_part_index: part.index,
                  expression_part_total: part.total,
                  trace_id: traceId,
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
              trace_id: traceId,
            })
            await updateTraceObservations(env, user.id, traceIds, {
              status: finalDegradationReason ? "degraded" : "ok",
              degradationReason: finalDegradationReason,
              firstResponseMs,
              totalDurationMs: Date.now() - observationStartedAt,
              promptTokens: tokenUsage.prompt,
              completionTokens: tokenUsage.completion,
              totalTokens: tokenUsage.total,
              modelCallCount: llmCalls.length,
            })
            traceIds.forEach((id) => activeTraceIds.delete(id))
            trySend(server, {
              type: "all_done",
              metadata: {
                emotion_state: result.emotionState,
                relationship_state: result.relationshipState,
                topics_count: 1,
              },
              trace_id: traceId,
              trace_ids: traceIds,
            })
          } else {
            await updateTraceObservations(env, user.id, traceIds, {
              status: "partial",
              degradationReason: interrupted
                ? "reply_interrupted"
                : "reply_delivery_failed",
              firstResponseMs,
              totalDurationMs: Date.now() - observationStartedAt,
              promptTokens: tokenUsage.prompt,
              completionTokens: tokenUsage.completion,
              totalTokens: tokenUsage.total,
              modelCallCount: llmCalls.length,
            })
            traceIds.forEach((id) => activeTraceIds.delete(id))
          }

          const persistLongTermMemory = async () => {
            const startedAt = Date.now()
            const memoryLlmCalls: LlmCallObservation[] = []
            const vectorResults: Array<{ success: boolean; reason?: string }> =
              []
            try {
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
                onLlmCall: (call) => memoryLlmCalls.push(call),
              })
              await recordConversationObservationEvent(env, {
                userId: user.id,
                traceId,
                stage: "memory.extract",
                status: memoryLlmCalls.some((call) => call.status !== "success")
                  ? "degraded"
                  : "ok",
                errorCode: memoryLlmCalls.find(
                  (call) => call.status !== "success",
                )?.fallbackReason,
              })
              await saveLongTermMemory(env, {
                userId: user.id,
                conversationId: result.conversationId,
                memory,
                onLlmCall: (call) => memoryLlmCalls.push(call),
                onVectorResult: (result) => vectorResults.push(result),
              })
              await appendBackgroundLlmCalls(env, {
                userId: user.id,
                traceId,
                traceIds,
                calls: memoryLlmCalls,
              })
              await recordConversationObservationEvent(env, {
                userId: user.id,
                traceId,
                stage: "memory.d1_write",
                status: "ok",
              })
              for (const vectorResult of vectorResults) {
                await recordConversationObservationEvent(env, {
                  userId: user.id,
                  traceId,
                  stage: "memory.vector_upsert",
                  status: vectorResult.success ? "ok" : "degraded",
                  errorCode: vectorResult.reason,
                })
              }
              if (vectorResults.some((result) => !result.success)) {
                await updateTraceObservations(env, user.id, traceIds, {
                  status: "partial",
                  degradationReason:
                    vectorResults.find((result) => !result.success)?.reason ??
                    "vector_upsert_failed",
                  vectorStored: false,
                })
              } else if (vectorResults.length > 0) {
                await updateTraceObservations(env, user.id, traceIds, {
                  vectorStored: true,
                })
              }
              await maybeSaveConversationSummary(env, {
                userId: user.id,
                conversationId: result.conversationId,
                messages: collectedContext,
              })
              await recordConversationObservationEvent(env, {
                userId: user.id,
                traceId,
                stage: "memory.summary_write",
                status: "ok",
              })
              await observeStorageWrite(env, {
                userId: user.id,
                traceId,
                stage: "storage.memory",
                startedAt,
                success: true,
              })
            } catch (error) {
              await observeStorageWrite(env, {
                userId: user.id,
                traceId,
                stage: "storage.memory",
                startedAt,
                success: false,
              })
              throw error
            }
          }
          if (executionCtx) {
            executionCtx.waitUntil(
              monitoredTask(env, persistLongTermMemory(), {
                traceId,
                userId: user.id,
                conversationId: result.conversationId,
                expressionGroupId,
                operation: "chat.persist_long_term_memory",
              }),
            )
          } else {
            await monitoredTask(env, persistLongTermMemory(), {
              traceId,
              userId: user.id,
              conversationId: result.conversationId,
              expressionGroupId,
              operation: "chat.persist_long_term_memory",
            })
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
          const startedAt = Date.now()
          const memoryLlmCalls: LlmCallObservation[] = []
          const vectorResults: Array<{ success: boolean; reason?: string }> = []
          try {
            const memory = await extractLongTermMemory(env, {
              userMessage: content,
              reply: result.reply,
              emotionState: result.emotionState,
              relationshipSnapshot: result.relationshipSnapshot,
              context: collectedContext,
              onLlmCall: (call) => memoryLlmCalls.push(call),
            })
            await recordConversationObservationEvent(env, {
              userId: user.id,
              traceId,
              stage: "memory.extract",
              status: memoryLlmCalls.some((call) => call.status !== "success")
                ? "degraded"
                : "ok",
              errorCode: memoryLlmCalls.find(
                (call) => call.status !== "success",
              )?.fallbackReason,
            })
            await saveLongTermMemory(env, {
              userId: user.id,
              conversationId: result.conversationId,
              memory,
              onLlmCall: (call) => memoryLlmCalls.push(call),
              onVectorResult: (result) => vectorResults.push(result),
            })
            await appendBackgroundLlmCalls(env, {
              userId: user.id,
              traceId,
              traceIds,
              calls: memoryLlmCalls,
            })
            await recordConversationObservationEvent(env, {
              userId: user.id,
              traceId,
              stage: "memory.d1_write",
              status: "ok",
            })
            for (const vectorResult of vectorResults) {
              await recordConversationObservationEvent(env, {
                userId: user.id,
                traceId,
                stage: "memory.vector_upsert",
                status: vectorResult.success ? "ok" : "degraded",
                errorCode: vectorResult.reason,
              })
            }
            if (vectorResults.some((result) => !result.success)) {
              await updateTraceObservations(env, user.id, traceIds, {
                status: "partial",
                degradationReason:
                  vectorResults.find((result) => !result.success)?.reason ??
                  "vector_upsert_failed",
                vectorStored: false,
              })
            } else if (vectorResults.length > 0) {
              await updateTraceObservations(env, user.id, traceIds, {
                vectorStored: true,
              })
            }
            await maybeSaveConversationSummary(env, {
              userId: user.id,
              conversationId: result.conversationId,
              messages: collectedContext,
            })
            await recordConversationObservationEvent(env, {
              userId: user.id,
              traceId,
              stage: "memory.summary_write",
              status: "ok",
            })
            await observeStorageWrite(env, {
              userId: user.id,
              traceId,
              stage: "storage.memory",
              startedAt,
              success: true,
            })
          } catch (error) {
            await observeStorageWrite(env, {
              userId: user.id,
              traceId,
              stage: "storage.memory",
              startedAt,
              success: false,
            })
            throw error
          }
        }
        if (executionCtx) {
          executionCtx.waitUntil(
            monitoredTask(env, persistLongTermMemory(), {
              traceId,
              userId: user.id,
              conversationId: result.conversationId,
              expressionGroupId,
              operation: "chat.persist_long_term_memory",
            }),
          )
        } else {
          await monitoredTask(env, persistLongTermMemory(), {
            traceId,
            userId: user.id,
            conversationId: result.conversationId,
            expressionGroupId,
            operation: "chat.persist_long_term_memory",
          })
        }
      },
      onNudge: (text, traceId) => {
        trySend(server, {
          type: "nudge",
          content: text,
          trace_id: traceId ?? requestTraceId,
        })
      },
      onError: (error, traceId) => {
        captureException(env, error, {
          traceId: traceId ?? requestTraceId,
          userId: user.id,
          operation: "chat.collector",
        })
        trySend(server, {
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed",
          trace_id: traceId ?? requestTraceId,
          trace_ids: [...activeTraceIds],
        })
        if (activeTraceIds.size > 0) {
          void updateTraceObservations(env, user.id, [...activeTraceIds], {
            status: "failed",
            degradationReason: "chat_failed",
          })
        }
        activeTraceIds.clear()
      },
    },
    evaluator,
  )

  server.addEventListener("message", async (event) => {
    let messageTraceId = requestTraceId
    try {
      connectionOpen = true
      const message = clientWsMessageSchema.parse(
        JSON.parse(String(event.data)),
      )
      if (message.type === "message") {
        messageTraceId = message.trace_id ?? requestTraceId
        if (messageTraceId) activeTraceIds.add(messageTraceId)
      }
      if (message.type === "ping") {
        trySend(server, { type: "pong" })
        return
      }

      if (message.type === "done") {
        replyGeneration += 1
        await collector.forceDone()
        return
      }

      if (message.type === "typing") {
        collector.noteTyping({
          sessionId: message.session_id,
          receivedAt: Date.now(),
        })
        return
      }

      replyGeneration += 1
      const alreadyReceived = await acknowledgeChatMessage(env, {
        userId: user.id,
        clientMessageId: message.client_message_id,
        socket: server,
        traceId: messageTraceId,
      })
      if (alreadyReceived) {
        if (messageTraceId) activeTraceIds.delete(messageTraceId)
        return
      }
      collector.addMessage({
        id: message.client_message_id,
        sessionId: message.session_id,
        content: message.content,
        agents: message.agents,
        traceId: messageTraceId,
        receivedAt: Date.now(),
      })
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        captureException(env, error, {
          traceId: messageTraceId,
          userId: user.id,
          operation: "chat.websocket_message",
        })
      }
      trySend(server, {
        type: "error",
        message: error instanceof Error ? error.message : "Chat failed",
        trace_id: messageTraceId,
        trace_ids: [...activeTraceIds],
      })
      activeTraceIds.clear()
    }
  })
  server.addEventListener("close", () => {
    connectionOpen = false
    void collector.forceDone().catch((error) => {
      captureException(env, error, {
        traceId: requestTraceId,
        userId: user.id,
        operation: "chat.disconnect",
      })
      console.error("Failed to finish disconnected chat reply", error)
    })
  })
  server.addEventListener("error", () => {
    connectionOpen = false
    void collector.forceDone().catch((error) => {
      captureException(env, error, {
        traceId: requestTraceId,
        userId: user.id,
        operation: "chat.socket_error",
      })
      console.error("Failed to finish errored chat reply", error)
    })
  })

  return new Response(null, {
    status: 101,
    webSocket: client,
  })
}
