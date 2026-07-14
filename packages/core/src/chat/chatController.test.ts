import assert from "node:assert/strict"
import { afterEach, describe, it, mock } from "node:test"
import {
  ChatController,
  type ChatConnectionStatus,
  type ChatSocketClientOptions,
} from "./chatController.js"
import type { ClientWsMessage } from "@ai-companion/shared"

class FakeChatWebSocketClient {
  closed = false
  sent: unknown[] = []

  constructor(readonly options: ChatSocketClientOptions) {}

  connect() {}

  send(message: ClientWsMessage) {
    this.sent.push(message)
  }

  close() {
    this.closed = true
  }
}

const tokens = {
  access_token: "access-token",
  refresh_token: "refresh-token",
}

function createHarness() {
  const clients: FakeChatWebSocketClient[] = []
  const statuses: ChatConnectionStatus[] = []
  const controller = new ChatController({
    wsUrl: "ws://localhost:8787/ws/chat",
    getTokens: () => tokens,
    onMessage: () => undefined,
    onStatus: (status) => statuses.push(status),
    createClient: (options) => {
      const client = new FakeChatWebSocketClient(options)
      clients.push(client)
      return client as never
    },
  })

  return {
    clients,
    controller,
    statuses,
  }
}

describe("ChatController reconnect", () => {
  afterEach(() => {
    mock.timers.reset()
  })

  it("reconnects after an unexpected close", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller, statuses } = createHarness()

    controller.connect()
    clients[0].options.onOpen?.()
    clients[0].options.onClose?.()

    assert.deepEqual(statuses, ["connecting", "connected", "reconnecting"])
    assert.equal(clients.length, 1)

    mock.timers.tick(999)
    assert.equal(clients.length, 1)

    mock.timers.tick(1)
    assert.equal(clients.length, 2)
    assert.equal(statuses.at(-1), "reconnecting")
  })

  it("uses exponential reconnect delays capped at 30 seconds", () => {
    assert.equal(ChatController.reconnectDelayForAttempt(0), 1000)
    assert.equal(ChatController.reconnectDelayForAttempt(1), 2000)
    assert.equal(ChatController.reconnectDelayForAttempt(2), 4000)
    assert.equal(ChatController.reconnectDelayForAttempt(3), 8000)
    assert.equal(ChatController.reconnectDelayForAttempt(4), 16000)
    assert.equal(ChatController.reconnectDelayForAttempt(5), 30000)
    assert.equal(ChatController.reconnectDelayForAttempt(12), 30000)
  })

  it("keeps growing delays across repeated failed reconnects", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onClose?.()
    mock.timers.tick(1000)
    assert.equal(clients.length, 2)

    clients[1].options.onClose?.()
    mock.timers.tick(1999)
    assert.equal(clients.length, 2)

    mock.timers.tick(1)
    assert.equal(clients.length, 3)
  })

  it("resets reconnect delay after a successful connection", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onClose?.()
    mock.timers.tick(1000)
    clients[1].options.onClose?.()
    mock.timers.tick(2000)

    clients[2].options.onOpen?.()
    clients[2].options.onClose?.()
    mock.timers.tick(999)
    assert.equal(clients.length, 3)

    mock.timers.tick(1)
    assert.equal(clients.length, 4)
  })

  it("does not reconnect after an explicit close", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller, statuses } = createHarness()

    controller.connect()
    controller.close()
    clients[0].options.onClose?.()
    mock.timers.tick(30000)

    assert.equal(clients.length, 1)
    assert.equal(clients[0].closed, true)
    assert.equal(statuses.at(-1), "idle")
  })

  it("clears pending reconnects when connect is called again", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onClose?.()
    controller.connect()
    mock.timers.tick(1000)

    assert.equal(clients.length, 2)
    assert.equal(clients[0].closed, true)
  })

  it("ignores close events from replaced clients", () => {
    mock.timers.enable({ apis: ["setTimeout"] })
    const { clients, controller, statuses } = createHarness()

    controller.connect()
    controller.connect()
    clients[0].options.onClose?.()
    mock.timers.tick(30000)

    assert.equal(clients.length, 2)
    assert.deepEqual(statuses, ["connecting", "connecting"])
  })
})

describe("ChatController send", () => {
  it("sends a single-agent chat message with session and persona context", () => {
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onOpen?.()
    controller.send("今天有点乱", "chat:agent-1", "m1", [
      {
        id: "agent-1",
        name: "小海",
        persona_prompt: "温柔地陪我整理情绪",
      },
    ])

    assert.deepEqual(clients[0].sent[0], {
      type: "message",
      content: "今天有点乱",
      session_id: "chat:agent-1",
      client_message_id: "m1",
      agents: [
        {
          id: "agent-1",
          name: "小海",
          persona_prompt: "温柔地陪我整理情绪",
        },
      ],
    })
  })

  it("sends a group chat message with multiple agent persona contexts", () => {
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onOpen?.()
    controller.send("一起帮我复盘一下", "group-1", "m2", [
      {
        id: "agent-1",
        name: "小海",
        persona_prompt: "温柔地陪我整理情绪",
      },
      {
        id: "agent-2",
        name: "晚风",
        persona_prompt: "提醒我慢一点说",
      },
    ])

    assert.deepEqual(clients[0].sent[0], {
      type: "message",
      content: "一起帮我复盘一下",
      session_id: "group-1",
      client_message_id: "m2",
      agents: [
        {
          id: "agent-1",
          name: "小海",
          persona_prompt: "温柔地陪我整理情绪",
        },
        {
          id: "agent-2",
          name: "晚风",
          persona_prompt: "提醒我慢一点说",
        },
      ],
    })
  })

  it("sends the same trace id with a chat message", () => {
    const { controller, clients } = createHarness()
    controller.connect()

    controller.send("hello", "chat-1", "m-trace", undefined, "trace-1")

    assert.deepEqual(clients[0]?.sent.at(-1), {
      type: "message",
      content: "hello",
      session_id: "chat-1",
      client_message_id: "m-trace",
      trace_id: "trace-1",
      agents: undefined,
    })
  })

  it("sends typing state for the active session", () => {
    const { clients, controller } = createHarness()

    controller.connect()
    clients[0].options.onOpen?.()
    controller.sendTyping("chat:agent-1")

    assert.deepEqual(clients[0].sent[0], {
      type: "typing",
      session_id: "chat:agent-1",
    })
  })
})
