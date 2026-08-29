// 常数时间字符串比较：按位累积差异，不因内容不同提前返回，避免
// 签名、哈希和静态密钥比较泄漏计时信息。长度差异直接判不等——长度
// 本身不作为可利用的计时通道。
export function timingSafeEquals(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) return false

  let diff = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index]
  }
  return diff === 0
}
