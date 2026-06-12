import {
  relationshipStateSchema,
  type RelationshipMood,
  type RelationshipState,
} from "@ai-companion/shared"
import type { Env } from "@/env"

type RelationshipRow = {
  user_id: string
  mood: RelationshipMood
  mood_intensity: number
  intimacy: number
  last_transition_at: number
  cooldown_until: number
  updated_at: number
}

export type RelationshipEvent =
  | "praise"
  | "gift"
  | "affection"
  | "conflict"
  | "mistake"
  | "user_sad"
  | "neglect"
  | "mention_other_person"
  | "apology"
  | "neutral"

export type RelationshipUpdate = {
  state: RelationshipState
  previous: RelationshipState
  event: RelationshipEvent
  changed: boolean
  snapshot: string | null
}

const cooldownMs = 30 * 1000
const calmThreshold = 15
const defaultIntimacy = 35

const minDurations: Record<RelationshipMood, number> = {
  calm: 0,
  happy: 5 * 60 * 1000,
  angry: 30 * 60 * 1000,
  sad: 15 * 60 * 1000,
  shy: 5 * 60 * 1000,
  jealous: 10 * 60 * 1000,
}

const halfLives: Record<RelationshipMood, number> = {
  calm: 0,
  happy: 30 * 60 * 1000,
  angry: 120 * 60 * 1000,
  sad: 60 * 60 * 1000,
  shy: 20 * 60 * 1000,
  jealous: 45 * 60 * 1000,
}

const negativeMoods = new Set<RelationshipMood>(["angry", "sad", "jealous"])

export function intimacyLevelFor(value: number) {
  if (value <= 20) return "polite"
  if (value <= 50) return "warm"
  if (value <= 70) return "attached"
  if (value <= 90) return "deep"
  return "full"
}

export function defaultRelationshipState(now = Date.now()): RelationshipState {
  return {
    mood: "calm",
    mood_intensity: 0,
    intimacy: defaultIntimacy,
    intimacy_level: intimacyLevelFor(defaultIntimacy),
    updated_at: now,
    last_transition_at: now,
    cooldown_until: 0,
  }
}

export async function ensureRelationshipStatesTable(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS relationship_states (
      user_id TEXT PRIMARY KEY,
      mood TEXT NOT NULL,
      mood_intensity INTEGER NOT NULL,
      intimacy INTEGER NOT NULL,
      last_transition_at INTEGER NOT NULL,
      cooldown_until INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ).run()
}

function fromRow(row: RelationshipRow | null, now: number) {
  if (!row) return defaultRelationshipState(now)
  return relationshipStateSchema.parse({
    mood: row.mood,
    mood_intensity: row.mood_intensity,
    intimacy: row.intimacy,
    intimacy_level: intimacyLevelFor(row.intimacy),
    updated_at: row.updated_at,
    last_transition_at: row.last_transition_at,
    cooldown_until: row.cooldown_until,
  })
}

export async function loadRelationshipState(
  env: Env,
  userId: string,
  now = Date.now(),
) {
  await ensureRelationshipStatesTable(env)
  const row = await env.DB.prepare(
    `SELECT
       user_id,
       mood,
       mood_intensity,
       intimacy,
       last_transition_at,
       cooldown_until,
       updated_at
     FROM relationship_states
     WHERE user_id = ?`,
  )
    .bind(userId)
    .first<RelationshipRow>()
  return applyDecay(fromRow(row, now), now)
}

export async function saveRelationshipState(
  env: Env,
  userId: string,
  state: RelationshipState,
) {
  await ensureRelationshipStatesTable(env)
  await env.DB.prepare(
    `INSERT INTO relationship_states (
       user_id,
       mood,
       mood_intensity,
       intimacy,
       last_transition_at,
       cooldown_until,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       mood = excluded.mood,
       mood_intensity = excluded.mood_intensity,
       intimacy = excluded.intimacy,
       last_transition_at = excluded.last_transition_at,
       cooldown_until = excluded.cooldown_until,
       updated_at = excluded.updated_at`,
  )
    .bind(
      userId,
      state.mood,
      state.mood_intensity,
      state.intimacy,
      state.last_transition_at,
      state.cooldown_until,
      state.updated_at,
    )
    .run()
}

export async function getRelationshipState(env: Env, userId: string) {
  const state = await loadRelationshipState(env, userId)
  await saveRelationshipState(env, userId, state)
  return state
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeState(state: RelationshipState): RelationshipState {
  const intimacy = clamp(state.intimacy)
  return {
    ...state,
    mood_intensity: clamp(state.mood_intensity),
    intimacy,
    intimacy_level: intimacyLevelFor(intimacy),
  }
}

export function applyDecay(
  state: RelationshipState,
  now = Date.now(),
): RelationshipState {
  if (state.mood === "calm") {
    return normalizeState({
      ...state,
      mood_intensity: 0,
      updated_at: now,
    })
  }

  const elapsed = Math.max(0, now - state.last_transition_at)
  if (elapsed < minDurations[state.mood]) {
    return normalizeState({ ...state, updated_at: now })
  }

  const halfLife = halfLives[state.mood]
  const decayed = state.mood_intensity * Math.pow(0.5, elapsed / halfLife)
  if (decayed < calmThreshold) {
    return normalizeState({
      ...state,
      mood: "calm",
      mood_intensity: 0,
      last_transition_at: now,
      cooldown_until: 0,
      updated_at: now,
    })
  }

  return normalizeState({
    ...state,
    mood_intensity: decayed,
    updated_at: now,
  })
}

export function detectRelationshipEvent(message: string): RelationshipEvent {
  const text = message.trim()
  if (!text) return "neutral"
  if (/(对不起|抱歉|不好意思|我错了|别生气|原谅|哄哄|解释一下)/.test(text)) {
    return "apology"
  }
  if (/(记错|忘了|又忘|怎么不记得|你不记得|你忘记)/.test(text)) {
    return "mistake"
  }
  if (/(吵|烦你|讨厌你|不理你|生气|冷战|分手|滚|闭嘴)/.test(text)) {
    return "conflict"
  }
  if (/(小李|小王|前任|女生|男生|异性|同事|别人).{0,12}(吃饭|约|喜欢|聊天|见面|陪)/.test(text)) {
    return "mention_other_person"
  }
  if (/(想你|喜欢你|爱你|抱抱|亲亲|陪我|在吗|表白)/.test(text)) {
    return "affection"
  }
  if (/(礼物|送你|买给你|惊喜|花|蛋糕)/.test(text)) {
    return "gift"
  }
  if (/(真好|可爱|厉害|漂亮|棒|夸夸|喜欢你这样|谢谢你|辛苦了)/.test(text)) {
    return "praise"
  }
  if (/(没人理|冷落|不在乎|不关心|都不陪|忽略)/.test(text)) {
    return "neglect"
  }
  if (/(难过|低落|委屈|孤独|焦虑|崩溃|失眠|撑不住|压力大)/.test(text)) {
    return "user_sad"
  }
  return "neutral"
}

function eventTarget(
  event: RelationshipEvent,
  state: RelationshipState,
): { mood: RelationshipMood; intensity: number; intimacyDelta: number } | null {
  switch (event) {
    case "praise":
    case "gift":
      return {
        mood: "happy",
        intensity: event === "gift" ? 58 : 45,
        intimacyDelta: event === "gift" ? 4 : 2,
      }
    case "affection":
      return {
        mood: state.intimacy >= 50 ? "shy" : "happy",
        intensity: state.intimacy >= 70 ? 62 : 46,
        intimacyDelta: state.intimacy >= 70 ? 4 : 3,
      }
    case "conflict":
      return {
        mood: "angry",
        intensity: state.intimacy >= 70 ? 74 : 58,
        intimacyDelta: state.intimacy >= 70 ? -8 : -5,
      }
    case "mistake":
      return {
        mood: "angry",
        intensity: state.intimacy >= 70 ? 80 : 65,
        intimacyDelta: state.intimacy >= 70 ? -12 : -7,
      }
    case "user_sad":
    case "neglect":
      return {
        mood: "sad",
        intensity: event === "neglect" ? 58 : 42,
        intimacyDelta: event === "neglect" ? -5 : 0,
      }
    case "mention_other_person":
      if (state.intimacy < 55) return null
      return {
        mood: "jealous",
        intensity: state.intimacy >= 75 ? 64 : 48,
        intimacyDelta: -2,
      }
    case "apology": {
      if (negativeMoods.has(state.mood)) {
        const recovery = state.intimacy >= 70 ? 44 : state.intimacy >= 50 ? 32 : 22
        const nextIntensity = Math.max(0, state.mood_intensity - recovery)
        return {
          mood: nextIntensity < calmThreshold ? "calm" : state.mood,
          intensity: nextIntensity,
          intimacyDelta: state.mood === "angry" ? 7 : 4,
        }
      }
      return {
        mood: "happy",
        intensity: Math.max(28, state.mood_intensity + 12),
        intimacyDelta: 2,
      }
    }
    default:
      return null
  }
}

function canBypassCooldown(event: RelationshipEvent, state: RelationshipState) {
  return event === "apology" && negativeMoods.has(state.mood)
}

export function updateRelationshipState(
  current: RelationshipState,
  message: string,
  now = Date.now(),
): RelationshipUpdate {
  const previous = applyDecay(current, now)
  const event = detectRelationshipEvent(message)
  const target = eventTarget(event, previous)

  if (!target) {
    return {
      state: previous,
      previous,
      event,
      changed: false,
      snapshot: null,
    }
  }

  if (previous.cooldown_until > now && !canBypassCooldown(event, previous)) {
    return {
      state: previous,
      previous,
      event,
      changed: false,
      snapshot: null,
    }
  }

  const moodChanged = target.mood !== previous.mood
  const intensity =
    moodChanged || event === "apology"
      ? target.intensity
      : Math.max(previous.mood_intensity, target.intensity)
  const next = normalizeState({
    ...previous,
    mood: target.mood,
    mood_intensity: intensity,
    intimacy: previous.intimacy + target.intimacyDelta,
    last_transition_at: moodChanged ? now : previous.last_transition_at,
    cooldown_until: moodChanged ? now + cooldownMs : previous.cooldown_until,
    updated_at: now,
  })
  const changed =
    next.mood !== previous.mood ||
    next.mood_intensity !== previous.mood_intensity ||
    next.intimacy !== previous.intimacy

  return {
    state: next,
    previous,
    event,
    changed,
    snapshot: changed ? relationshipSnapshot(previous, next, event) : null,
  }
}

function relationshipSnapshot(
  previous: RelationshipState,
  next: RelationshipState,
  event: RelationshipEvent,
) {
  const intimacyDelta = next.intimacy - previous.intimacy
  const important =
    event === "conflict" ||
    event === "mistake" ||
    event === "apology" ||
    event === "neglect" ||
    Math.abs(intimacyDelta) >= 5
  if (!important) return null

  const direction = intimacyDelta > 0 ? "增加" : intimacyDelta < 0 ? "下降" : "不变"
  return [
    `关系事件：${event}`,
    `情绪从 ${previous.mood} 变为 ${next.mood}`,
    `强度 ${previous.mood_intensity} 到 ${next.mood_intensity}`,
    `亲密度${direction}到 ${next.intimacy}`,
  ].join("，")
}
