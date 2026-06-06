import type { AuthTokens, ServerWsMessage } from "@ai-companion/shared";
import { ChatWebSocketClient } from "@ai-companion/api-client";

export type ChatControllerOptions = {
  wsUrl: string;
  getTokens: () => AuthTokens | null;
  onMessage: (message: ServerWsMessage) => void;
  onStatus?: (status: "idle" | "connected" | "disconnected" | "error") => void;
};

export class ChatController {
  private client: ChatWebSocketClient | null = null;

  constructor(private readonly options: ChatControllerOptions) {}

  connect() {
    const tokens = this.options.getTokens();
    if (!tokens) {
      throw new Error("Missing access token");
    }
    this.client?.close();
    this.client = new ChatWebSocketClient({
      url: this.options.wsUrl,
      accessToken: tokens.access_token,
      onMessage: this.options.onMessage,
      onOpen: () => this.options.onStatus?.("connected"),
      onClose: () => this.options.onStatus?.("disconnected"),
      onError: () => this.options.onStatus?.("error")
    });
    this.client.connect();
  }

  send(content: string, sessionId: string, clientMessageId: string) {
    this.client?.send({
      type: "message",
      content,
      session_id: sessionId,
      client_message_id: clientMessageId
    });
  }

  ping() {
    this.client?.send({ type: "ping" });
  }

  close() {
    this.client?.close();
    this.client = null;
    this.options.onStatus?.("idle");
  }
}
