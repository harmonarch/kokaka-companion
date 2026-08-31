export const missingAuthFieldsMessage = "请输入邮箱和密码"
export const passwordTooShortMessage = "密码至少需要 8 位"

export function getAuthFieldsError(
  email: string,
  password: string,
  mode: "login" | "register",
) {
  if (!email.trim() || !password.trim()) return missingAuthFieldsMessage
  if (mode === "register" && password.length < 8) return passwordTooShortMessage
  return null
}
