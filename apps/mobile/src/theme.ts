import { useColorScheme } from "react-native"

export type AppTheme = ReturnType<typeof useAppTheme>

const light = {
  mode: "light",
  background: "#f7f6f1",
  surface: "#ffffff",
  softSurface: "#eef1ed",
  text: "#17211c",
  muted: "#526057",
  subtle: "#778078",
  border: "#cfd6ce",
  softBorder: "#dfe4df",
  bubbleBorder: "#d9ded8",
  primary: "#1f6f5b",
  primaryPressed: "#1a5c4c",
  primaryText: "#f8fbf8",
  danger: "#b13434",
  dangerBorder: "#c44",
  dangerSurface: "#fff1ee",
}

const dark = {
  mode: "dark",
  background: "#101815",
  surface: "#18231f",
  softSurface: "#1f2d28",
  text: "#eef3ed",
  muted: "#b4c0b7",
  subtle: "#8fa096",
  border: "#34443d",
  softBorder: "#2a3933",
  bubbleBorder: "#3c4d45",
  primary: "#7fc8b2",
  primaryPressed: "#98d7c4",
  primaryText: "#0d1814",
  danger: "#ffb4a9",
  dangerBorder: "#a85a52",
  dangerSurface: "#301b19",
}

export function useAppTheme() {
  return useColorScheme() === "dark" ? dark : light
}
