import type { AuthTokens, User } from "@ai-companion/shared"
import type { HttpClient, TokenStore } from "@ai-companion/api-client"

export type SessionState = {
  user: User | null
  tokens: AuthTokens | null
}

export class SessionManager {
  private state: SessionState = {
    user: null,
    tokens: null,
  }

  readonly tokenStore: TokenStore = {
    getTokens: () => this.state.tokens,
    setTokens: (tokens) => {
      this.state = { ...this.state, tokens }
    },
  }

  getState() {
    return this.state
  }

  setUser(user: User | null) {
    this.state = { ...this.state, user }
  }

  async refreshUser(client: HttpClient) {
    const user = await client.me()
    this.setUser(user)
    return user
  }

  clear() {
    this.state = { user: null, tokens: null }
  }
}
