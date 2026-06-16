export type UserScopedRequestState = {
  loaded: boolean
  loading: boolean
  userId: string | null
}

export type SessionScopedRequestState = UserScopedRequestState & {
  sessionId: string | null
}

export function shouldLoadForUser(
  state: UserScopedRequestState,
  userId: string,
) {
  if (state.loaded && state.userId === userId) return false
  if (state.loading && state.userId === userId) return false
  return true
}

export function isSameSession(
  state: SessionScopedRequestState,
  userId: string,
  sessionId: string,
) {
  return state.userId === userId && state.sessionId === sessionId
}

export function shouldResetSession(
  state: SessionScopedRequestState,
  userId: string,
  sessionId: string,
) {
  return !isSameSession(state, userId, sessionId)
}

export function shouldLoadForSession(
  state: SessionScopedRequestState,
  userId: string,
  sessionId: string,
) {
  if (!isSameSession(state, userId, sessionId)) return true
  if (state.loaded) return false
  if (state.loading) return false
  return true
}
