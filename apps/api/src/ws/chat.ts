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

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForMinimumReplyingTime(replyingStartedAt: number) {
  const elapsed = Date.now() - replyingStartedAt
  const remaining = 3000 - elapsed
  if (remaining > 0) await wait(remaining)
}

async function updateCollectedHistory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    expressionGroupId: string
    syntheticUserMessageId: string
    pending: PendingMessage[]
    reply: string
    context: ChatMessage[] | undefined
  },
): Promise<ChatMessage[]> {
  const currentAgentMessage = [...(input.context ?? [])]
    .reverse()
    .find((message) => message.role === "agent")
  const agentMessage: ChatMessage = {
    id: currentAgentMessage?.id ?? crypto.randomUUID(),
    role: "agent",
    content: input.reply,
    created_at: currentAgentMessage?.created_at ?? Date.now(),
    expression_group_id: input.expressionGroupId,
    expression_part_index: null,
  }
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
  const deleteIds = [input.syntheticUserMessageId, agentMessage.id]

  await replaceChatMessages(env, {
    userId: input.userId,
    conversationId: input.conversationId,
    deleteIds,
    messages: [...userMessages, agentMessage],
  }).catch((error) => {
    console.error("Failed to replace collected chat history", error)
  })

  const currentContext = (input.context ?? []).filter(
    (message) => !deleteIds.includes(message.id),
  )
  const messages = [...currentContext, ...userMessages, agentMessage].slice(-20)
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
        })

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
          for (const delta of chunks(result.reply)) {
            send(server, {
              type: "token",
              topic_id: "default",
              delta,
            })
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
