export type CreateAgentInput = {
  name: string
  personaPrompt: string
  avatarUrl?: string | null
  copyPersonaPrompt?: boolean
}

export type CreateGroupInput = {
  title: string
  agentIds: string[]
}

export type ChatListPalette = {
  listBackground: string
  navigationBar: string
  rowSurface: string
  rowPressed: string
}
