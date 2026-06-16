import { Platform } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"

type WebNoFocusHighlight = {
  outlineColor?: string
  outlineStyle?: "none"
  outlineWidth?: number
  boxShadow?: "none"
}

const webNoFocusHighlight =
  Platform.OS === "web"
    ? {
        outlineColor: "transparent",
        outlineStyle: "none" as const,
        outlineWidth: 0,
        boxShadow: "none" as const,
      }
    : null

export const webNoFocusInputHighlight:
  | (TextStyle & WebNoFocusHighlight)
  | null = webNoFocusHighlight

export const webNoFocusViewHighlight:
  | (ViewStyle & WebNoFocusHighlight)
  | null = webNoFocusHighlight
