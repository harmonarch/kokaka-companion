import { clientWsMessageSchema } from "@ai-companion/shared";
import type { Env } from "@/env";
import { findUserById } from "@/auth/session";
import { verifyAccessToken } from "@/auth/tokens";
import { runAgent } from "@/agent/graph";
import {
  extractLongTermMemory,
  maybeSaveConversationSummary,
  saveLongTermMemory
} from "@/agent/memory/longTermMemory";

function send(socket: WebSocket, payload: unknown) {
  socket.send(JSON.stringify(payload));
}

function chunks(value: string) {
  const parts = value.match(/.{1,16}/gs);
  return parts && parts.length > 0 ? parts : [value];
}

export async function handleChatWebSocket(
  request: Request,
  env: Env,
  executionCtx?: ExecutionContext
) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload = await verifyAccessToken(token, env);
  const user = payload ? await findUserById(env, payload.sub) : null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  server.addEventListener("message", async (event) => {
    try {
      const message = clientWsMessageSchema.parse(JSON.parse(String(event.data)));
      if (message.type === "ping") {
        send(server, { type: "pong" });
        return;
      }

      send(server, {
        type: "topic_start",
        topic_id: "default",
        label: "当前消息",
        index: 1,
        total: 1
      });
      const result = await runAgent(env, {
        userId: user.id,
        message: message.content,
        conversationId: message.session_id,
        userMessageId: message.client_message_id
      });
      for (const delta of chunks(result.reply)) {
        send(server, {
          type: "token",
          topic_id: "default",
          delta
        });
      }
      send(server, {
        type: "topic_done",
        topic_id: "default"
      });
      send(server, {
        type: "all_done",
        metadata: {
          emotion_state: result.emotionState,
          topics_count: 1
        }
      });
      const persistLongTermMemory = async () => {
        const memory = await extractLongTermMemory(env, {
          userMessage: message.content,
          reply: result.reply,
          emotionState: result.emotionState
        });
        await saveLongTermMemory(env, {
          userId: user.id,
          conversationId: result.conversationId,
          memory
        });
        await maybeSaveConversationSummary(env, {
          userId: user.id,
          conversationId: result.conversationId,
          messages: result.context
        });
      };
      if (executionCtx) {
        executionCtx.waitUntil(persistLongTermMemory());
      } else {
        await persistLongTermMemory();
      }
    } catch (error) {
      send(server, {
        type: "error",
        message: error instanceof Error ? error.message : "Chat failed"
      });
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client
  });
}
