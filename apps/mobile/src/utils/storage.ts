import type { AuthTokens, ChatProfiles } from "@ai-companion/shared"

const key = "kokaka.tokens"
const chatProfilesKeyPrefix = "kokaka.chatProfiles."

export async function loadTokens(): Promise<AuthTokens | null> {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as AuthTokens) : null
}

export async function saveTokens(tokens: AuthTokens | null) {
  if (typeof localStorage === "undefined") return
  if (!tokens) {
    localStorage.removeItem(key)
    return
  }
  localStorage.setItem(key, JSON.stringify(tokens))
}

function chatProfilesKey(userId: string) {
  return `${chatProfilesKeyPrefix}${userId}`
}

export async function loadChatProfiles(
  userId: string,
): Promise<ChatProfiles | null> {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(chatProfilesKey(userId))
  return raw ? (JSON.parse(raw) as ChatProfiles) : null
}

export async function saveChatProfiles(
  userId: string,
  profiles: ChatProfiles,
) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(chatProfilesKey(userId), JSON.stringify(profiles))
}
