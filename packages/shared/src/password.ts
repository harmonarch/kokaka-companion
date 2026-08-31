import { sha256 } from "js-sha256"

// 前端对明文密码先做一层摘要，请求体里不再传明文；服务端会再叠加
// salt + pepper 后存储/校验（双层哈希）。
export function hashClientPassword(password: string): string {
  return sha256(password)
}
