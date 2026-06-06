import { END, START, StateGraph } from "@langchain/langgraph";
import type { Env } from "@/env";
import { detectEmotionNode } from "@/agent/nodes/emotion";
import { reasoningNode } from "@/agent/nodes/reasoning";
import { strategyNode } from "@/agent/nodes/strategy";
import { createGenerateNode } from "@/agent/nodes/generate";
import { createLoadContextNode, createPersistContextNode } from "@/agent/nodes/persist";
import type { AgentRunResult, AgentState } from "@/agent/state";

export async function runAgent(
  env: Env,
  input: { userId: string; message: string }
): Promise<AgentRunResult> {
  const graph = new StateGraph<AgentState>({
    channels: {
      userId: null,
      userMessage: null,
      context: null,
      emotionState: null,
      reasoning: null,
      strategy: null,
      reply: null
    }
  })
    .addNode("loadContext", createLoadContextNode(env))
    .addNode("detectEmotion", detectEmotionNode)
    .addNode("reason", reasoningNode)
    .addNode("selectStrategy", strategyNode)
    .addNode("generateReply", createGenerateNode(env))
    .addNode("persistContext", createPersistContextNode(env))
    .addEdge(START, "loadContext")
    .addEdge("loadContext", "detectEmotion")
    .addEdge("detectEmotion", "reason")
    .addEdge("reason", "selectStrategy")
    .addEdge("selectStrategy", "generateReply")
    .addEdge("generateReply", "persistContext")
    .addEdge("persistContext", END)
    .compile();

  const result = await graph.invoke({
    userId: input.userId,
    userMessage: input.message,
    context: [],
    emotionState: "normal",
    reasoning: "",
    strategy: "",
    reply: ""
  });

  return {
    emotionState: result.emotionState,
    reply: result.reply
  };
}
