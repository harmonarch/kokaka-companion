import { useColorScheme } from "react-native"

export type AppTheme = ReturnType<typeof useAppTheme>

const light = {
  mode: "light",
  background: "#ededed",
  surface: "#ffffff",
  elevated: "#f7f7f7",
  field: "#ffffff",
  text: "#111111",
  muted: "#7a7a7a",
  subtle: "#9b9b9b",
  link: "#576b95",
  border: "#d7d7d7",
  softBorder: "#e4e4e4",
  bubbleBorder: "#eeeeee",
  primary: "#5ac86f",
  primarySoft: "#a8e985",
  primaryPressed: "#4cb961",
  primaryText: "#111111",
  accent: "#111111",
  danger: "#e05656",
  dangerBorder: "#f0c0c0",
  dangerSurface: "#fff2f2",
}

const dark = {
  mode: "dark",
  background: "#1b1b1b",
  surface: "#232323",
  elevated: "#2b2b2b",
  field: "#2a2a2a",
  text: "#e8e8e8",
  muted: "#9d9d9d",
  subtle: "#858585",
  link: "#7f91bd",
  border: "#343434",
  softBorder: "#2f2f2f",
  bubbleBorder: "#303030",
  primary: "#55b66e",
  primarySoft: "#63ce80",
  primaryPressed: "#4aa461",
  primaryText: "#101010",
  accent: "#e8e8e8",
  danger: "#ff6b64",
  dangerBorder: "#693332",
  dangerSurface: "#2b2020",
}

export function useAppTheme() {
  return useColorScheme() === "dark" ? dark : light
}
