import type { ChatMessage, RecentContext } from "@ai-companion/shared";
import { recentContextSchema } from "@ai-companion/shared";
import type { Env } from "@/env";
import type { AgentState } from "@/agent/state";

export async function loadContext(env: Env, userId: string) {
  const raw = await env.CHAT_CONTEXT.get(`ctx:${userId}`);
  if (!raw) return [];
  const parsed = recentContextSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.messages : [];
}

export function createLoadContextNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => ({
    context: await loadContext(env, state.userId)
  });
}

export function createPersistContextNode(env: Env) {
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: state.userMessage,
      created_at: now
    };
    const agentMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "agent",
      content: state.reply,
      created_at: now
    };
    const messages: ChatMessage[] = [
      ...state.context,
      userMessage,
      agentMessage
    ].slice(-20);
    const context: RecentContext = { messages };
    await env.CHAT_CONTEXT.put(`ctx:${state.userId}`, JSON.stringify(context), {
      expirationTtl: 60 * 60 * 24
    });
    await env.CHAT_CONTEXT.put(`mood:${state.userId}`, state.emotionState, {
      expirationTtl: 60 * 60 * 24 * 7
    });
    return { context: messages };
  };
}
