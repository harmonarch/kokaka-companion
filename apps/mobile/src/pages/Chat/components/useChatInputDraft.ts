import { useState } from "react"
import { removeSubmittedDraft } from "./voiceRecording"

export function useChatInputDraft({
  disabled,
  onTyping,
  onSend,
}: {
  disabled?: boolean
  onTyping?: () => void
  onSend: (content: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const trimmedValue = value.trim()
  const cannotSend = disabled || !trimmedValue

  function setDraftValue(nextValue: string) {
    setValue(nextValue)
    if (!disabled && nextValue.trim()) onTyping?.()
  }

  function submit() {
    if (cannotSend) return
    const submittedDraft = value
    void onSend(trimmedValue)
      .then(() =>
        setValue((currentValue) =>
          removeSubmittedDraft(currentValue, submittedDraft),
        ),
      )
      .catch(() => undefined)
  }

  return {
    value,
    setValue: setDraftValue,
    cannotSend,
    submit,
  }
}
