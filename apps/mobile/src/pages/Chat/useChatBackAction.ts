import { router } from "expo-router"

export function useChatBackAction() {
  return {
    goBack: router.back,
  }
}
