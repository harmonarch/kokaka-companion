import type { EmotionState } from "@ai-companion/shared"
import { StyleSheet, Text, View } from "react-native"
import type { AppTheme } from "@/theme"

const emotionLabels: Record<EmotionState, string> = {
  normal: "现在看起来比较平稳",
  vulnerable: "我会慢一点陪你",
  crisis: "这段感受很重，我会认真陪着",
  positive: "这份开心也值得被记住",
}

const connectionLabels: Record<string, string> = {
  connected: "Kokaka 在这里",
  connecting: "Kokaka 正在靠近",
  disconnected: "正在重新靠近你",
}

export function AgentStatus({
  connection,
  emotionState,
  theme,
}: {
  connection: string
  emotionState: EmotionState | null
  theme: AppTheme
}) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.primarySoft, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.dot, { color: theme.primary }]}>•</Text>
        <Text style={[styles.text, { color: theme.text }]}>
          {connectionLabels[connection] ?? "正在确认陪伴状态"}
        </Text>
      </View>
      <Text style={[styles.text, styles.mood, { color: theme.muted }]}>
        {emotionState ? emotionLabels[emotionState] : "可以从任何一句话开始"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: {
    fontSize: 18,
    lineHeight: 18,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  mood: {
    flexShrink: 1,
  },
})
