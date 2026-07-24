export const missingAuthFieldsMessage = "请输入邮箱和密码"

export function getAuthFieldsError(email: string, password: string) {
  if (!email.trim() || !password.trim()) return missingAuthFieldsMessage
  return null
}
