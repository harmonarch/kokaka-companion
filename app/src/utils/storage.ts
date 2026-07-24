import type { AuthTokens, User } from "@ai-companion/shared"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"

const key = "kokaka.tokens"
const userKey = "kokaka.user"

export async function loadJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  return raw ? (JSON.parse(raw) as T) : null
}

export async function saveJson<T>(key: string, value: T | null) {
  if (!value) {
    await AsyncStorage.removeItem(key)
    return
  }
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

export async function loadTokens(): Promise<AuthTokens | null> {
  const raw = await SecureStore.getItemAsync(key)
  return raw ? (JSON.parse(raw) as AuthTokens) : null
}

export async function saveTokens(tokens: AuthTokens | null) {
  if (!tokens) {
    await SecureStore.deleteItemAsync(key)
    return
  }
  await SecureStore.setItemAsync(key, JSON.stringify(tokens))
}

export async function loadUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(userKey)
  return raw ? (JSON.parse(raw) as User) : null
}

export async function saveUser(user: User | null) {
  if (!user) {
    await SecureStore.deleteItemAsync(userKey)
    return
  }
  await SecureStore.setItemAsync(userKey, JSON.stringify(user))
}
