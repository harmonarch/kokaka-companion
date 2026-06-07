import { useColorScheme } from "react-native"

export type AppTheme = ReturnType<typeof useAppTheme>

const light = {
  mode: "light",
  background: "#f6f2e9",
  surface: "#ffffff",
  elevated: "#fffaf0",
  softSurface: "#edf3ee",
  text: "#17211c",
  muted: "#526057",
  subtle: "#778078",
  border: "#cfd6ce",
  softBorder: "#dfe4df",
  bubbleBorder: "#d9ded8",
  primary: "#1f6f5b",
  primarySoft: "#dceee7",
  primaryPressed: "#1a5c4c",
  primaryText: "#f8fbf8",
  accent: "#dca85f",
  accentSoft: "#f5dfbc",
  danger: "#b13434",
  dangerBorder: "#c44",
  dangerSurface: "#fff1ee",
}

const dark = {
  mode: "dark",
  background: "#0f1716",
  surface: "#17231f",
  elevated: "#1c2a25",
  softSurface: "#1f2f2a",
  text: "#eef3ed",
  muted: "#b4c0b7",
  subtle: "#8fa096",
  border: "#34443d",
  softBorder: "#2a3933",
  bubbleBorder: "#3c4d45",
  primary: "#7fc8b2",
  primarySoft: "#203f37",
  primaryPressed: "#98d7c4",
  primaryText: "#0d1814",
  accent: "#f0c47d",
  accentSoft: "#463823",
  danger: "#ffb4a9",
  dangerBorder: "#a85a52",
  dangerSurface: "#301b19",
}

export function useAppTheme() {
  return useColorScheme() === "dark" ? dark : light
}
