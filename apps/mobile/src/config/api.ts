import Constants from "expo-constants"
import { Platform } from "react-native"

const apiPort = 8787

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)
}

function expoHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri

  return hostUri?.split(":")[0]
}

function webHost() {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined
  return window.location.hostname
}

function defaultHost() {
  return expoHost() ?? webHost() ?? "localhost"
}

export const apiBaseUrl =
  firstConfiguredValue(process.env.EXPO_PUBLIC_API_BASE_URL) ??
  `http://${defaultHost()}:${apiPort}`

export const chatWsUrl =
  firstConfiguredValue(process.env.EXPO_PUBLIC_WS_URL) ??
  `ws://${defaultHost()}:${apiPort}/ws/chat`
