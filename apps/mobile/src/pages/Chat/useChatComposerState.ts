import { useChatStore } from "@/stores/chatStore"

export function useChatComposerState() {
  const status = useChatStore((state) => state.status)
  const connection = useChatStore((state) => state.connection)

  const inputDisabled = connection !== "connected" || status !== "idle"
  const disabledReason =
    connection !== "connected"
      ? "正在重新连接，马上就能继续说。"
      : status !== "idle"
        ? "Kokaka 正在读你的话，等这一句回来后就能继续。"
        : undefined

  return {
    inputDisabled,
    disabledReason,
  }
}
