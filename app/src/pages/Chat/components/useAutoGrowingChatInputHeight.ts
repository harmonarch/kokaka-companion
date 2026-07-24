import { useState } from "react"
import { useWindowDimensions } from "react-native"
import type { LayoutChangeEvent } from "react-native"

const maxHeightRatio = 0.25

export function useAutoGrowingChatInputHeight(value: string) {
  const { height: screenHeight } = useWindowDimensions()
  const [contentHeight, setContentHeight] = useState<number>()
  const [baseHeight, setBaseHeight] = useState<number>()
  const maxHeight = screenHeight * maxHeightRatio
  const hasValue = value.length > 0
  const shouldUseMeasuredHeight =
    hasValue &&
    contentHeight !== undefined &&
    (baseHeight === undefined || contentHeight > baseHeight)
  const height = shouldUseMeasuredHeight
    ? Math.min(contentHeight, maxHeight)
    : undefined
  const measuredValue = value.endsWith("\n") ? `${value} ` : value

  function handleInputLayout(event: LayoutChangeEvent) {
    if (height !== undefined) return

    const nextHeight = event.nativeEvent.layout.height
    setBaseHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    )
  }

  function handleMeasureLayout(event: LayoutChangeEvent) {
    const nextHeight = event.nativeEvent.layout.height
    setContentHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    )
  }

  return {
    hasValue,
    height,
    maxHeight,
    measuredValue,
    handleInputLayout,
    handleMeasureLayout,
  }
}
