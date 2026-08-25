export const networkErrorMessage = "网络连接失败，请检查网络，或稍后再试。"

export function getNetworkErrorMessage(error: unknown) {
  return isNetworkError(error) ? networkErrorMessage : null
}

export const authCredentialsErrorMessage = "邮箱或密码错误，请检查后重试。"

export function getAuthCredentialsError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : null
  return status === 401 ? authCredentialsErrorMessage : null
}

export function getReadableErrorMessage(error: unknown, fallback: string) {
  if (isNetworkError(error)) return null

  const message = error instanceof Error ? error.message : String(error ?? "")
  const normalized = message.toLowerCase()
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : null

  if (status === 401) {
    return "登录状态已过期，请重新登录。"
  }

  if (status === 502 || status === 503 || status === 504) {
    return "服务暂时不可用，请稍后再试。"
  }

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("token") ||
    normalized.includes("401")
  ) {
    return "登录状态已过期，请重新登录。"
  }

  if (normalized === "request failed") return fallback

  return message || fallback
}

function isNetworkError(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number(error.status)
      : null
  if (status !== null && Number.isFinite(status)) return false

  const message = error instanceof Error ? error.message : String(error ?? "")
  const normalized = message.toLowerCase()

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("service unavailable")
  ) {
    return true
  }

  return false
}
