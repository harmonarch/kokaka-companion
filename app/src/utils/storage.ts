import type { AuthTokens, User } from "@ai-companion/shared"
import * as SecureStore from "expo-secure-store"

const key = "kokaka.tokens"
const userKey = "kokaka.user"

function canUseLocalStorage() {
  return typeof localStorage !== "undefined"
}

async function getItem(key: string) {
  if (canUseLocalStorage()) return localStorage.getItem(key)
  return SecureStore.getItemAsync(key)
}

async function setItem(key: string, value: string) {
  if (canUseLocalStorage()) {
    localStorage.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function deleteItem(key: string) {
  if (canUseLocalStorage()) {
    localStorage.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export async function loadJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key)
  return raw ? (JSON.parse(raw) as T) : null
}

export async function saveJson<T>(key: string, value: T | null) {
  if (!value) {
    await deleteItem(key)
    return
  }
  await setItem(key, JSON.stringify(value))
}

export async function loadTokens(): Promise<AuthTokens | null> {
  return loadJson<AuthTokens>(key)
}

export async function saveTokens(tokens: AuthTokens | null) {
  await saveJson(key, tokens)
}

export async function loadUser(): Promise<User | null> {
  return loadJson<User>(userKey)
}

export async function saveUser(user: User | null) {
  await saveJson(userKey, user)
}
