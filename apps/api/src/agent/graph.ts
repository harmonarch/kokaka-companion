import { END, START, StateGraph } from "@langchain/langgraph"
import type { Env } from "@/env"
import { detectEmotionNode } from "@/agent/nodes/emotion"
import { reasoningNode } from "@/agent/nodes/reasoning"
import { strategyNode } from "@/agent/nodes/strategy"
import { createGenerateNode } from "@/agent/nodes/generate"
import { createLoadLongTermMemoryNode } from "@/agent/nodes/longTermMemory"
import { createHybridMemorySearchNode } from "@/agent/nodes/hybridMemorySearch"
import { createUpdateRelationshipNode } from "@/agent/nodes/relationship"
import { defaultRelationshipState } from "@/agent/relationship/stateMachine"
import {
  createLoadContextNode,
  createPersistContextNode,
} from "@/agent/nodes/persist"
import type { AgentRunResult, AgentState } from "@/agent/state"

export async function runAgent(
  env: Env,
  input: {
    userId: string
    message: string
    conversationId?: string
    userMessageId?: string
    shortMessageBurst?: boolean
  },
): Promise<AgentRunResult> {
  const graph = new StateGraph<AgentState>({
    channels: {
      userId: null,
      conversationId: null,
      userMessageId: null,
      userMessage: null,
      shortMessageBurst: null,
      context: null,
      longTermMemory: null,
      memorySearch: null,
      emotionState: null,
      relationshipState: null,
      relationshipEvent: null,
      relationshipSnapshot: null,
      reasoning: null,
      strategy: null,
      reply: null,
    },
  })
    .addNode("loadContext", createLoadContextNode(env))
    .addNode("loadLongTermMemory", createLoadLongTermMemoryNode(env))
    .addNode("searchHybridMemory", createHybridMemorySearchNode(env))
    .addNode("detectEmotion", detectEmotionNode)
    .addNode("updateRelationship", createUpdateRelationshipNode(env))
    .addNode("reason", reasoningNode)
    .addNode("selectStrategy", strategyNode)
    .addNode("generateReply", createGenerateNode(env))
    .addNode("persistContext", createPersistContextNode(env))
    .addEdge(START, "loadContext")
    .addEdge("loadContext", "loadLongTermMemory")
    .addEdge("loadLongTermMemory", "searchHybridMemory")
    .addEdge("searchHybridMemory", "detectEmotion")
    .addEdge("detectEmotion", "updateRelationship")
    .addEdge("updateRelationship", "reason")
    .addEdge("reason", "selectStrategy")
    .addEdge("selectStrategy", "generateReply")
    .addEdge("generateReply", "persistContext")
    .addEdge("persistContext", END)
    .compile()

  const conversationId = input.conversationId ?? crypto.randomUUID()
  const result = await graph.invoke({
    userId: input.userId,
    conversationId,
    userMessageId: input.userMessageId,
    userMessage: input.message,
    shortMessageBurst: input.shortMessageBurst ?? false,
    context: [],
    longTermMemory: {
      enabled: true,
      profile: null,
      memories: [],
      summaries: [],
    },
    memorySearch: {
      query: input.message,
      keywords: [],
      results: [],
    },
    emotionState: "normal",
    relationshipState: defaultRelationshipState(),
    relationshipEvent: "neutral",
    relationshipSnapshot: null,
    reasoning: "",
    strategy: "",
    reply: "",
  })

  return {
    emotionState: result.emotionState,
    relationshipState: result.relationshipState,
    relationshipSnapshot: result.relationshipSnapshot,
    reply: result.reply,
    conversationId,
    context: result.context,
  }
}
