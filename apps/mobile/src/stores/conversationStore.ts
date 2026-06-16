import type {
  ChatConversation as SharedChatConversation,
  ChatConversationAgent,
  ChatConversationsResponse,
  CreateGroupChatRequest,
  CreateSingleChatRequest,
} from "@ai-companion/shared"
import { create } from "zustand"
import { useAuthStore } from "@/stores/authStore"
import { shouldLoadForUser } from "./requestCache"

export type AgentProfile = ChatConversationAgent
export type ChatConversation = SharedChatConversation

type ConversationState = {
  agents: AgentProfile[]
  conversations: ChatConversation[]
  userAvatarUrl: string | null
  userName: string | null
  activeConversationId: string | null
  ready: boolean
  loading: boolean
  userId: string | null
  error: string | null
  hydrate: () => Promise<void>
  createAgent: (input: {
    name: string
    personaPrompt: string
    avatarUrl?: string | null
    copyPersonaPrompt?: boolean
  }) => Promise<string>
  createGroup: (input: { title: string; agentIds: string[] }) => Promise<string>
  setActiveConversation: (conversationId: string) => void
  updateConversationPreview: (conversationId: string, message: string) => void
  getConversationAgents: (conversationId: string) => AgentProfile[]
}

const defaultAgent: AgentProfile = {
  id: "agent:xiaolian",
  name: "小练",
  avatar_url: null,
  persona_prompt: "温柔地陪我整理情绪",
  created_at: 1,
  updated_at: 1,
}

const defaultConversation: ChatConversation = {
  id: "default",
  type: "single",
  title: "小练",
  agent_ids: [defaultAgent.id],
  last_message: "可以从一句很小的话开始",
  created_at: 1,
  updated_at: 1,
}

const legacyDefaultConversationIds = new Set(["chat:agent:kogether"])

function now() {
  return Date.now()
}

function normalizeConversationId(input?: string | null) {
  const id = input?.trim()
  if (!id) return null
  return legacyDefaultConversationIds.has(id) ? defaultConversation.id : id
}

function normalizeConversation(
  input: Partial<ChatConversation>,
  agents: AgentProfile[],
): ChatConversation | null {
  const conversationId = normalizeConversationId(input.id)
  const isDefaultConversation = conversationId === defaultConversation.id
  const agentIds = (input.agent_ids ?? []).filter((id) =>
    agents.some((agent) => agent.id === id),
  )
  if (!agentIds.length) return null
  const firstAgent = agents.find((agent) => agent.id === agentIds[0])
  const type =
    input.type === "group" || agentIds.length > 1 ? "group" : "single"
  return {
    id:
      conversationId ||
      (type === "single" ? `chat:${agentIds[0]}` : `group:${now()}`),
    type,
    title:
      input.title?.trim() ||
      (type === "single"
        ? firstAgent?.name || defaultConversation.title
        : `${agentIds.length} 个 Agent 的群聊`),
    agent_ids: agentIds,
    last_message:
      input.last_message?.trim() ||
      (isDefaultConversation ? defaultConversation.last_message : "还没有消息"),
    created_at:
      input.created_at ||
      (isDefaultConversation ? defaultConversation.created_at : now()),
    updated_at:
      input.updated_at ||
      input.created_at ||
      (isDefaultConversation ? defaultConversation.updated_at : now()),
  }
}

function withDefaults(input?: Partial<ChatConversationsResponse>) {
  const agentsById = new Map<string, AgentProfile>()
  agentsById.set(defaultAgent.id, defaultAgent)
  for (const agent of input?.agents ?? []) {
    agentsById.set(agent.id, {
      ...agent,
      name: agent.name.trim() || "新的 Agent",
      avatar_url: agent.avatar_url?.trim() || null,
      persona_prompt: agent.persona_prompt?.trim() || "",
    })
  }
  const agents = [...agentsById.values()]
  const conversationsById = new Map<string, ChatConversation>()
  for (const conversation of input?.conversations ?? []) {
    const normalized = normalizeConversation(conversation, agents)
    if (!normalized) continue
    const existing = conversationsById.get(normalized.id)
    if (!existing || normalized.updated_at >= existing.updated_at) {
      conversationsById.set(normalized.id, normalized)
    }
  }
  const conversations = [...conversationsById.values()]
    .map((conversation) => normalizeConversation(conversation, agents))
    .filter((conversation): conversation is ChatConversation =>
      Boolean(conversation),
    )

  if (!conversations.some((item) => item.id === defaultConversation.id)) {
    conversations.push(defaultConversation)
  }

  const sorted = conversations.sort((a, b) => b.updated_at - a.updated_at)
  return {
    agents,
    conversations: sorted,
    userAvatarUrl: input?.user?.avatar_url?.trim() || null,
    userName: input?.user?.nickname?.trim() || null,
  }
}

function getNextActiveConversationId(
  conversations: ChatConversation[],
  current: string | null,
) {
  const normalizedCurrent = normalizeConversationId(current)
  if (
    normalizedCurrent &&
    conversations.some((conversation) => conversation.id === normalizedCurrent)
  ) {
    return normalizedCurrent
  }
  return conversations[0]?.id || defaultConversation.id
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  agents: [defaultAgent],
  conversations: [defaultConversation],
  userAvatarUrl: null,
  userName: null,
  activeConversationId: defaultConversation.id,
  ready: false,
  loading: false,
  userId: null,
  error: null,
  hydrate: async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      const state = withDefaults()
      set({
        ...state,
        activeConversationId: defaultConversation.id,
        ready: true,
        loading: false,
        userId: null,
        error: null,
      })
      return
    }
    const userId = user.id
    const current = get()
    if (current.userId !== userId) {
      set({ ready: false, loading: false, userId })
    }
    if (
      current.userId === userId &&
      !shouldLoadForUser(
        { loaded: current.ready, loading: current.loading, userId },
        userId,
      )
    ) {
      return
    }
    set({ loading: true, userId, error: null })
    try {
      const response = await useAuthStore.getState().client.chatConversations()
      if (useAuthStore.getState().user?.id !== userId) return
      const state = withDefaults(response)
      set({
        ...state,
        activeConversationId: getNextActiveConversationId(
          state.conversations,
          get().activeConversationId,
        ),
        ready: true,
        loading: false,
        userId,
        error: null,
      })
    } catch (error) {
      if (useAuthStore.getState().user?.id !== userId) return
      const state = withDefaults()
      set({
        ...state,
        activeConversationId: defaultConversation.id,
        ready: true,
        loading: false,
        userId,
        error: error instanceof Error ? error.message : "聊天列表载入失败",
      })
    }
  },
  createAgent: async ({
    name,
    personaPrompt,
    avatarUrl,
    copyPersonaPrompt,
  }) => {
    const input: CreateSingleChatRequest = {
      name,
      avatar_url: avatarUrl || null,
      persona_prompt: copyPersonaPrompt ? undefined : personaPrompt,
      copy_persona_prompt: Boolean(copyPersonaPrompt),
    }
    const response = await useAuthStore
      .getState()
      .client.createSingleChat(input)
    const current = get()
    const agents = response.agent
      ? [
          response.agent,
          ...current.agents.filter((agent) => agent.id !== response.agent?.id),
        ]
      : current.agents
    const conversations = [
      response.conversation,
      ...current.conversations.filter(
        (conversation) => conversation.id !== response.conversation.id,
      ),
    ].sort((a, b) => b.updated_at - a.updated_at)
    const next = {
      agents,
      conversations,
      activeConversationId: response.conversation.id,
    }
    set(next)
    return response.conversation.id
  },
  createGroup: async ({ title, agentIds }) => {
    const input: CreateGroupChatRequest = {
      title: title.trim() || undefined,
      agent_ids: agentIds,
    }
    const response = await useAuthStore.getState().client.createGroupChat(input)
    const current = get()
    const conversations = [
      response.conversation,
      ...current.conversations.filter(
        (conversation) => conversation.id !== response.conversation.id,
      ),
    ].sort((a, b) => b.updated_at - a.updated_at)
    const next = {
      conversations,
      activeConversationId: response.conversation.id,
    }
    set(next)
    return response.conversation.id
  },
  setActiveConversation: (conversationId) => {
    const state = get()
    if (!state.conversations.some((item) => item.id === conversationId)) return
    set({ activeConversationId: conversationId })
  },
  updateConversationPreview: (conversationId, message) => {
    const timestamp = now()
    const state = get()
    set({
      conversations: state.conversations
        .map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                last_message: message.trim() || conversation.last_message,
                updated_at: timestamp,
              }
            : conversation,
        )
        .sort((a, b) => b.updated_at - a.updated_at),
    })
  },
  getConversationAgents: (conversationId) => {
    const state = get()
    const conversation = state.conversations.find(
      (item) => item.id === conversationId,
    )
    if (!conversation) return [defaultAgent]
    return conversation.agent_ids
      .map((id) => state.agents.find((agent) => agent.id === id))
      .filter((agent): agent is AgentProfile => Boolean(agent))
  },
}))
