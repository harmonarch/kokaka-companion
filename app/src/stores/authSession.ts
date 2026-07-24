export type SessionTokens = {
  access_token: string
}

export type SessionUser = {
  id: string
  email: string
  nickname: string | null
}

export function shouldClearSessionAfterRefreshError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : null

  return status === 401
}

export function getUserAfterRefreshError(
  error: unknown,
  cachedUser: SessionUser | null,
  tokens: SessionTokens | null,
) {
  if (shouldClearSessionAfterRefreshError(error)) return null
  return cachedUser ?? getUserFromAccessToken(tokens?.access_token)
}

function getUserFromAccessToken(accessToken: string | undefined) {
  const userId = getAccessTokenUserId(accessToken)
  if (!userId) return null

  return {
    id: userId,
    email: `${userId}@local.invalid`,
    nickname: null,
  }
}

function getAccessTokenUserId(accessToken: string | undefined) {
  const [, body] = accessToken?.split(".") ?? []
  if (!body) return null

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as { sub?: unknown }
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

function decodeBase64Url(value: string) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const input = value.replaceAll("-", "+").replaceAll("_", "/")
  let output = ""
  let buffer = 0
  let bits = 0

  for (const char of input) {
    if (char === "=") break
    const index = chars.indexOf(char)
    if (index === -1) throw new Error("Invalid base64url")
    buffer = (buffer << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }

  return output
}
