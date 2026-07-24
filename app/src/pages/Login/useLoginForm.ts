import { useState } from "react"

export type LoginMode = "login" | "register"

export function useLoginForm() {
  const [mode, setMode] = useState<LoginMode>("register")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")

  return {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    nickname,
    setNickname,
  }
}
