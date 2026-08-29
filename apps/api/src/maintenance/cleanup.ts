import type { Env } from "@/env"

const OBSERVATION_RETENTION_SECONDS = 30 * 24 * 3600

// 清理过期 refresh token 与超过保留期的会话观测数据。
// 事件表对观测表有外键级联，这里仍先显式删事件，不依赖 D1 的
// 外键开关状态。
export async function cleanupExpiredData(env: Env) {
  const now = Math.floor(Date.now() / 1000)
  const observationCutoff = now - OBSERVATION_RETENTION_SECONDS

  await env.DB.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?")
    .bind(now)
    .run()
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM conversation_observation_events WHERE occurred_at < ?",
    ).bind(observationCutoff),
    env.DB.prepare(
      "DELETE FROM conversation_observations WHERE started_at < ?",
    ).bind(observationCutoff),
  ])
}
