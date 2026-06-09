import { useState } from "react"

export function useProfileEditorError() {
  const [error, setError] = useState<string | null>(null)

  return {
    error,
    setError,
  }
}
