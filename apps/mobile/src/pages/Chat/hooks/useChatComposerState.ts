import { useChatStore } from "@/stores/chatStore"

export function useChatComposerState() {
  const connection = useChatStore((state) => state.connection)

  const inputDisabled = connection !== "connected"
  const disabledReason =
    connection !== "connected"
      ? "正在重新连接，马上就能继续说。"
      : undefined

  return {
    inputDisabled,
    disabledReason,
  }
}
