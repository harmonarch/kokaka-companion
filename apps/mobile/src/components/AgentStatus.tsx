import type { EmotionState } from "@ai-companion/shared";
import { StyleSheet, Text, View } from "react-native";

const labels: Record<EmotionState, string> = {
  normal: "平稳",
  vulnerable: "低落",
  crisis: "沉重",
  positive: "开心"
};

export function AgentStatus({
  connection,
  emotionState
}: {
  connection: string;
  emotionState: EmotionState | null;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>连接：{connection}</Text>
      <Text style={styles.text}>状态：{emotionState ? labels[emotionState] : "未识别"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap"
  },
  text: {
    color: "#526057",
    fontSize: 13
  }
});
