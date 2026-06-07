import type { AuthTokens } from "@ai-companion/shared"

const key = "kokaka.tokens"

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
