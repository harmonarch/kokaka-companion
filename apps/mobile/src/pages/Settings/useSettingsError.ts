import { useState } from "react"

export function useSettingsError() {
  const [error, setError] = useState<string | null>(null)

  return {
    error,
    setError,
  }
}
