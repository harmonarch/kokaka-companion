import type { ClientWsMessage, ServerWsMessage } from "@ai-companion/shared"
import { serverWsMessageSchema } from "@ai-companion/shared"

export type ChatWebSocketClientOptions = {
  url: string
  accessToken: string
  onMessage: (message: ServerWsMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

export class ChatWebSocketClient {
  private socket: WebSocket | null = null

  constructor(private readonly options: ChatWebSocketClientOptions) {}

  connect() {
    const separator = this.options.url.includes("?") ? "&" : "?"
    this.socket = new WebSocket(
      `${this.options.url}${separator}token=${encodeURIComponent(
        this.options.accessToken,
      )}`,
    )
    this.socket.onopen = () => this.options.onOpen?.()
    this.socket.onclose = () => this.options.onClose?.()
    this.socket.onerror = (event) => this.options.onError?.(event)
    this.socket.onmessage = (event) => {
      try {
        const parsed = serverWsMessageSchema.parse(JSON.parse(event.data))
        this.options.onMessage(parsed)
      } catch {
        this.options.onMessage({
          type: "error",
          message: "收到无法识别的服务端消息。",
        })
      }
    }
  }

  send(message: ClientWsMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Chat socket is not connected")
    }
    this.socket.send(JSON.stringify(message))
  }

  close() {
    this.socket?.close()
    this.socket = null
  }
}
