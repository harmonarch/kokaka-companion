import type {
  ChatAgentContext,
  ClientWsMessage,
  ServerWsMessage,
} from "@ai-companion/shared"

export type ChatConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"

export type ChatSocketClientOptions = {
  url: string
  ticket: string
  onMessage: (message: ServerWsMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  onProtocolError?: (error: unknown) => void
}

export type ChatSocketClient = {
  connect: () => void
  send: (message: ClientWsMessage) => void
  close: () => void
}

export type ChatControllerOptions = {
  wsUrl: string
  createTicket: () => Promise<string>
  onMessage: (message: ServerWsMessage) => void
  onStatus?: (status: ChatConnectionStatus) => void
  createClient: (options: ChatSocketClientOptions) => ChatSocketClient
  onSocketError?: (error: Event) => void
  onProtocolError?: (error: unknown) => void
  onSendError?: (error: unknown, traceId?: string) => void
}

export class ChatController {
  private static readonly reconnectDelays = [
    1000, 2000, 4000, 8000, 16000, 30000,
  ]

  private client: ChatSocketClient | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private manuallyClosed = false
  private connectionId = 0

  constructor(private readonly options: ChatControllerOptions) {}

  async connect() {
    this.manuallyClosed = false
    this.clearReconnectTimer()
    this.reconnectAttempt = 0
    await this.connectClient("connecting")
  }

  private async connectClient(status: ChatConnectionStatus) {
    this.connectionId += 1
    const connectionId = this.connectionId
    const previousClient = this.client
    this.client = null
    previousClient?.close()
    this.options.onStatus?.(status)

    let ticket: string
    try {
      ticket = await this.options.createTicket()
    } catch {
      this.options.onStatus?.("error")
      this.scheduleReconnect()
      return
    }
    if (connectionId !== this.connectionId) return

    this.client = this.options.createClient({
      url: this.options.wsUrl,
      ticket,
      onMessage: this.options.onMessage,
      onOpen: () => {
        if (connectionId !== this.connectionId) return
        this.reconnectAttempt = 0
        this.options.onStatus?.("connected")
      },
      onClose: () => {
        if (connectionId !== this.connectionId) return
        this.scheduleReconnect()
      },
      onError: (error) => {
        if (connectionId !== this.connectionId) return
        this.options.onStatus?.("error")
        this.options.onSocketError?.(error)
      },
      onProtocolError: (error) => {
        if (connectionId !== this.connectionId) return
        this.options.onProtocolError?.(error)
      },
    })
    this.client.connect()
  }

  send(
    content: string,
    sessionId: string,
    clientMessageId: string,
    agents?: ChatAgentContext[],
    traceId?: string,
  ) {
    try {
      this.client?.send({
        type: "message",
        content,
        session_id: sessionId,
        client_message_id: clientMessageId,
        ...(traceId ? { trace_id: traceId } : {}),
        agents,
      })
    } catch (error) {
      this.options.onStatus?.("error")
      this.options.onSendError?.(error, traceId)
      throw error
    }
  }

  sendTyping(sessionId: string) {
    try {
      this.client?.send({
        type: "typing",
        session_id: sessionId,
      })
    } catch {
      // ponytail: typing is best-effort; send failures should not interrupt input.
    }
  }

  ping() {
    try {
      this.client?.send({ type: "ping" })
    } catch (error) {
      this.options.onStatus?.("error")
      throw error
    }
  }

  close() {
    this.manuallyClosed = true
    this.connectionId += 1
    this.clearReconnectTimer()
    this.client?.close()
    this.client = null
    this.options.onStatus?.("idle")
  }

  private scheduleReconnect() {
    if (this.manuallyClosed) return
    if (this.reconnectTimer) return

    this.options.onStatus?.("reconnecting")
    const delay = ChatController.reconnectDelayForAttempt(this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.manuallyClosed) return
      this.connectClient("reconnecting")
    }, delay)
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  static reconnectDelayForAttempt(attempt: number) {
    const index = Math.min(
      Math.max(attempt, 0),
      ChatController.reconnectDelays.length - 1,
    )
    return ChatController.reconnectDelays[index]
  }
}
