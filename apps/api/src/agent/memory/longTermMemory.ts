import type { ChatMessage } from "@ai-companion/shared"
import type { Env } from "@/env"
import {
  deleteMemoryVector,
  upsertMemoryVector,
} from "@/agent/memory/vectorMemory"

export type LongTermMemoryProfile = {
  userId: string
  name: string | null
  birthday: string | null
  occupation: string | null
  company: string | null
  location: string | null
  updatedAt: number
}

export type LongTermMemoryItem = {
  type: string
  content: string
  createdAt: number
}

export type ConversationSummary = {
  summary: string
  startTime: number
  endTime: number
  messageCount: number
}

export type LongTermMemoryContext = {
  enabled: boolean
  profile: LongTermMemoryProfile | null
  memories: LongTermMemoryItem[]
  summaries: ConversationSummary[]
}

export type ExtractedFact = {
  field: "name" | "birthday" | "occupation" | "company" | "location"
  value: string
}

export type ExtractedLongTermMemory = {
  facts: ExtractedFact[]
  events: string[]
  preferences: string[]
  emotionSnapshot: string | null
}

type MemoryType = "event" | "preference" | "emotion_snapshot"

const profileFields = new Set<ExtractedFact["field"]>([
  "name",
  "birthday",
  "occupation",
  "company",
  "location",
])

const emptyExtraction: ExtractedLongTermMemory = {
  facts: [],
  events: [],
  preferences: [],
  emotionSnapshot: null,
}

const LONG_TERM_MEMORY_CACHE_TTL_SECONDS = 60 * 15

export function longTermMemoryCacheKey(userId: string) {
  return `ltm:${userId}`
}

function now() {
  return Date.now()
}

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function cleanFactValue(value: string) {
  return value.trim().replace(/[了啦呢啊呀。！？!?，,]+$/g, "")
}

function hasSelfReference(value: string) {
  return /(^|[\s，,。！？!?])(我|我的|自己|本人|咱|咱们|我们)/.test(value)
}

function asksAboutAssistant(value: string) {
  const assistantRef = /(你|您|你们|小练|助手|助理|模型|Kokaka|kokaka)/
  const questionLike = /[?？]|什么|吗|呢|如何|怎么|是不是|能不能|会不会|有没有/
  const personalTopic =
    /(喜欢|讨厌|生日|名字|叫|工作|公司|住|在哪|心情|想法|建议)/
  return (
    assistantRef.test(value) &&
    questionLike.test(value) &&
    personalTopic.test(value) &&
    !hasSelfReference(value)
  )
}

function canStoreUserUtterance(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (asksAboutAssistant(trimmed)) return false
  if (/^[你您]/.test(trimmed) && /[?？]?$/.test(trimmed)) {
    return hasSelfReference(trimmed)
  }
  return true
}

function parseJsonObject(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as unknown
  } catch {
    return null
  }
}

function normalizeExtraction(value: unknown): ExtractedLongTermMemory {
  if (!value || typeof value !== "object") return emptyExtraction
  const raw = value as {
    facts?: unknown
    events?: unknown
    preferences?: unknown
    emotionSnapshot?: unknown
  }

  const facts = Array.isArray(raw.facts)
    ? raw.facts
        .map((fact) => {
          if (!fact || typeof fact !== "object") return null
          const candidate = fact as {
            field?: unknown
            value?: unknown
          }
          if (
            typeof candidate.field !== "string" ||
            typeof candidate.value !== "string"
          ) {
            return null
          }
          const field = candidate.field as ExtractedFact["field"]
          if (!profileFields.has(field)) return null
          const value = cleanFactValue(candidate.value)
          return value ? { field, value } : null
        })
        .filter((fact): fact is ExtractedFact => Boolean(fact))
    : []

  const events = Array.isArray(raw.events)
    ? uniq(
        raw.events.filter(
          (event): event is string => typeof event === "string",
        ),
      )
    : []
  const preferences = Array.isArray(raw.preferences)
    ? uniq(
        raw.preferences.filter(
          (preference): preference is string => typeof preference === "string",
        ),
      )
    : []
  const emotionSnapshot =
    typeof raw.emotionSnapshot === "string" && raw.emotionSnapshot.trim()
      ? raw.emotionSnapshot.trim()
      : null

  return { facts, events, preferences, emotionSnapshot }
}

function removeAssistantSourcedMemory(
  memory: ExtractedLongTermMemory,
): ExtractedLongTermMemory {
  const assistantPattern =
    /(?:助手|助理|模型|系统)(?:说|表示|认为|判断|建议|提醒|回复|回答)|(?:建议用户|提醒用户)|(?:助手|助理|模型|系统)的/
  const isUserSourced = (value: string) => !assistantPattern.test(value)

  return {
    facts: memory.facts.filter((fact) => isUserSourced(fact.value)),
    events: memory.events.filter(isUserSourced),
    preferences: memory.preferences.filter(isUserSourced),
    emotionSnapshot:
      memory.emotionSnapshot && isUserSourced(memory.emotionSnapshot)
        ? memory.emotionSnapshot
        : null,
  }
}

function normalizeForSourceCheck(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]/gu, "")
}

function digitSignature(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "")
}

function sourceFragments(value: string) {
  const normalized = normalizeForSourceCheck(value)
  const ignored = new Set([
    "用户",
    "喜欢",
    "不喜欢",
    "讨厌",
    "提到",
    "觉得",
    "现在",
    "今天",
    "明天",
    "下周",
    "当前",
    "情绪",
    "状态",
  ])
  const fragments = new Set<string>()

  for (let size = 2; size <= Math.min(8, normalized.length); size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      const fragment = normalized.slice(index, index + size)
      if (!ignored.has(fragment)) {
        fragments.add(fragment)
      }
    }
  }
  return fragments
}

function hasUserSource(value: string, userMessage: string) {
  const normalizedValue = normalizeForSourceCheck(value)
  const normalizedUserMessage = normalizeForSourceCheck(userMessage)
  if (!normalizedValue || !normalizedUserMessage) return false
  if (
    normalizedValue.includes(normalizedUserMessage) ||
    normalizedUserMessage.includes(normalizedValue)
  ) {
    return true
  }

  const valueDigits = digitSignature(value)
  const userDigits = digitSignature(userMessage)
  if (
    valueDigits.length >= 2 &&
    userDigits.length >= 2 &&
    (valueDigits.includes(userDigits) || userDigits.includes(valueDigits))
  ) {
    return true
  }

  for (const fragment of sourceFragments(userMessage)) {
    if (normalizedValue.includes(fragment)) return true
  }
  return false
}

function keepUserSupportedMemory(
  memory: ExtractedLongTermMemory,
  userMessage: string,
): ExtractedLongTermMemory {
  return {
    facts: memory.facts.filter((fact) => hasUserSource(fact.value, userMessage)),
    events: memory.events.filter((event) => hasUserSource(event, userMessage)),
    preferences: memory.preferences.filter((preference) =>
      hasUserSource(preference, userMessage),
    ),
    emotionSnapshot:
      memory.emotionSnapshot &&
      hasUserSource(memory.emotionSnapshot, userMessage)
        ? memory.emotionSnapshot
        : null,
  }
}

function mergeExtractions(
  fallback: ExtractedLongTermMemory,
  extracted: ExtractedLongTermMemory,
): ExtractedLongTermMemory {
  const factsByField = new Map<ExtractedFact["field"], ExtractedFact>()
  for (const fact of fallback.facts) {
    factsByField.set(fact.field, fact)
  }
  for (const fact of extracted.facts) {
    factsByField.set(fact.field, fact)
  }

  return {
    facts: [...factsByField.values()],
    events: uniq([...fallback.events, ...extracted.events]),
    preferences: uniq([...fallback.preferences, ...extracted.preferences]),
    emotionSnapshot: extracted.emotionSnapshot ?? fallback.emotionSnapshot,
  }
}

function latestMemoryRows(memory: ExtractedLongTermMemory) {
  const rowsByType = new Map<MemoryType, string>()

  for (const content of memory.events) {
    rowsByType.set("event", content)
  }
  for (const content of memory.preferences) {
    rowsByType.set("preference", content)
  }
  if (memory.emotionSnapshot) {
    rowsByType.set("emotion_snapshot", memory.emotionSnapshot)
  }

  return [...rowsByType.entries()].map(([type, content]) => ({
    type,
    content,
  }))
}

export async function isLongTermMemoryEnabled(env: Env, userId: string) {
  const row = await env.DB.prepare(
    "SELECT long_term_memory_enabled AS enabled FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(userId)
    .first<{ enabled: number }>()
  return row?.enabled !== 0
}

export async function loadLongTermMemory(
  env: Env,
  userId: string,
): Promise<LongTermMemoryContext> {
  const enabled = await isLongTermMemoryEnabled(env, userId)
  if (!enabled) {
    await invalidateLongTermMemoryCache(env, userId)
    return { enabled: false, profile: null, memories: [], summaries: [] }
  }

  const cached = await env.CHAT_CONTEXT.get(longTermMemoryCacheKey(userId))
  if (cached) {
    const parsed = parseLongTermMemoryContext(cached)
    if (parsed) return parsed
  }

  const context = await loadLongTermMemoryFromD1(env, userId)
  await env.CHAT_CONTEXT.put(
    longTermMemoryCacheKey(userId),
    JSON.stringify(context),
    {
      expirationTtl: LONG_TERM_MEMORY_CACHE_TTL_SECONDS,
    },
  )
  return context
}

function parseLongTermMemoryContext(raw: string) {
  try {
    const parsed = JSON.parse(raw) as LongTermMemoryContext
    if (
      typeof parsed.enabled === "boolean" &&
      (parsed.profile === null || typeof parsed.profile === "object") &&
      Array.isArray(parsed.memories) &&
      Array.isArray(parsed.summaries)
    ) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

async function loadLongTermMemoryFromD1(
  env: Env,
  userId: string,
): Promise<LongTermMemoryContext> {
  const [profile, memoriesResult, summariesResult] = await Promise.all([
    env.DB.prepare(
      `SELECT
        user_id AS userId,
        name,
        birthday,
        occupation,
        company,
        location,
        updated_at AS updatedAt
       FROM user_profiles
       WHERE user_id = ?`,
    )
      .bind(userId)
      .first<LongTermMemoryProfile>(),
    env.DB.prepare(
      `SELECT type, content, created_at AS createdAt
       FROM memories
       WHERE user_id = ?
       ORDER BY created_at DESC
      LIMIT 20`,
    )
      .bind(userId)
      .all<LongTermMemoryItem>(),
    env.DB.prepare(
      `SELECT
        summary,
        start_time AS startTime,
        end_time AS endTime,
        message_count AS messageCount
       FROM conversation_summaries
       WHERE user_id = ?
       ORDER BY end_time DESC
       LIMIT 3`,
    )
      .bind(userId)
      .all<ConversationSummary>(),
  ])

  return {
    enabled: true,
    profile: profile ?? null,
    memories: memoriesResult.results ?? [],
    summaries: summariesResult.results ?? [],
  }
}

export async function invalidateLongTermMemoryCache(env: Env, userId: string) {
  await env.CHAT_CONTEXT.delete(longTermMemoryCacheKey(userId))
}

export function formatLongTermMemory(context: LongTermMemoryContext) {
  if (!context.enabled) return "长期记忆已关闭。"

  const profileLines = []
  if (context.profile?.name) profileLines.push(`姓名：${context.profile.name}`)
  if (context.profile?.birthday) {
    profileLines.push(`生日：${context.profile.birthday}`)
  }
  if (context.profile?.occupation) {
    profileLines.push(`职业：${context.profile.occupation}`)
  }
  if (context.profile?.company) {
    profileLines.push(`当前公司：${context.profile.company}`)
  }
  if (context.profile?.location) {
    profileLines.push(`所在地：${context.profile.location}`)
  }

  const memoryLines = context.memories.map(
    (memory) => `[${memory.type}] ${memory.content}`,
  )
  const summaryLines = context.summaries.map(
    (summary) => `[summary] ${summary.summary}`,
  )

  if (
    profileLines.length === 0 &&
    memoryLines.length === 0 &&
    summaryLines.length === 0
  ) {
    return "暂无长期记忆。"
  }

  return [
    profileLines.length > 0 ? `用户画像：\n${profileLines.join("\n")}` : "",
    memoryLines.length > 0 ? `记忆条目：\n${memoryLines.join("\n")}` : "",
    summaryLines.length > 0 ? `近期摘要：\n${summaryLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export function heuristicExtractLongTermMemory(
  userMessage: string,
  emotionSnapshot: string | null = null,
): ExtractedLongTermMemory {
  const facts: ExtractedFact[] = []
  const events: string[] = []
  const preferences: string[] = []
  const text = userMessage.trim()
  const canStoreText = canStoreUserUtterance(text)

  const birthday = text.match(
    /(?:生日(?:是|在)?|我(?:的)?生日(?:是|在)?)(\d{1,2})\s*(?:月|-)\s*(\d{1,2})\s*(?:日|号)?/,
  )
  if (birthday) {
    facts.push({
      field: "birthday",
      value: `${birthday[1].padStart(2, "0")}-${birthday[2].padStart(2, "0")}`,
    })
  }

  const name = text.match(
    /(?:我叫|我是)([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_-]{0,11})/,
  )
  if (name && !["去", "在", "做", "喜欢", "讨厌", "不想"].includes(name[1])) {
    facts.push({ field: "name", value: cleanFactValue(name[1]) })
  }

  const location = text.match(
    /(?:我(?:现在)?在|我住在)([\u4e00-\u9fa5A-Za-z]{2,12})/,
  )
  if (location && !text.includes("工作") && !text.includes("上班")) {
    facts.push({ field: "location", value: cleanFactValue(location[1]) })
  }

  const jobChange = text.match(
    /(?:我)?(?:下周|明天|今天|现在|刚刚|之后|开始)?(?:去|在)([\u4e00-\u9fa5A-Za-z0-9]{2,20})(?:做|当|负责)([\u4e00-\u9fa5A-Za-z0-9]{1,16})/,
  )
  if (canStoreText && jobChange) {
    const company = cleanFactValue(jobChange[1])
    const occupation = cleanFactValue(jobChange[2])
    facts.push({ field: "company", value: company })
    facts.push({ field: "occupation", value: occupation })
    events.push(`用户提到工作变化：将去${company}做${occupation}`)
  }

  const occupation = text.match(
    /(?:我是|我做|我的工作是)([\u4e00-\u9fa5A-Za-z0-9]{2,16})/,
  )
  if (canStoreText && occupation && !text.includes("我叫")) {
    facts.push({ field: "occupation", value: cleanFactValue(occupation[1]) })
  }

  if (canStoreText && /(喜欢|爱|偏爱)/.test(text)) {
    preferences.push(`用户${text}`)
  }
  if (
    canStoreText &&
    /(不喜欢|讨厌|反感|别.*说教|不要.*说教|不想.*建议)/.test(text)
  ) {
    preferences.push(`用户${text}`)
  }

  if (
    canStoreText &&
    /(被裁|分手|离职|换工作|入职|面试|吵架|搬家|生病|住院|毕业|结婚)/.test(text)
  ) {
    events.push(`用户提到重要事件：${text}`)
  }

  return {
    facts,
    events: uniq(events),
    preferences: uniq(preferences),
    emotionSnapshot,
  }
}

export async function extractLongTermMemory(
  env: Env,
  input: {
    userMessage: string
    reply: string
    emotionState: string
  },
): Promise<ExtractedLongTermMemory> {
  const canStoreText = canStoreUserUtterance(input.userMessage)
  if (!canStoreText) return emptyExtraction

  const fallback = heuristicExtractLongTermMemory(
    input.userMessage,
    input.emotionState === "normal"
      ? null
      : `用户当前情绪状态：${input.emotionState}`,
  )
  if (!env.DEEPSEEK_API_KEY) return fallback

  try {
    const response = await fetch(
      `${env.DEEPSEEK_BASE_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          messages: [
            {
              role: "system",
              content: [
                "请从这轮对话提取长期记忆，并只返回 JSON。",
                "JSON 格式：",
                '{"facts":[{"field":"name|birthday|occupation|company|location","value":"..."}],"events":["..."],"preferences":["..."],"emotionSnapshot":"...或null"}',
                "只提取用户主动透露的个人事实、重大生活事件、明确偏好和明显情绪。",
                "输入只包含用户原文，不要补充、推测或使用助手表达过的信息。",
                "忽略闲聊、一次性请求和无法确认的信息。",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `用户原文：${input.userMessage}`,
                `情绪状态：${input.emotionState}`,
              ].join("\n"),
            },
          ],
          temperature: 0,
          max_tokens: 360,
        }),
      },
    )
    if (!response.ok) return fallback
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return fallback
    return mergeExtractions(
      fallback,
      keepUserSupportedMemory(
        removeAssistantSourcedMemory(normalizeExtraction(parseJsonObject(content))),
        input.userMessage,
      ),
    )
  } catch {
    return fallback
  }
}

export async function saveLongTermMemory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    memory: ExtractedLongTermMemory
  },
) {
  const enabled = await isLongTermMemoryEnabled(env, input.userId)
  if (!enabled) return

  const timestamp = now()
  let changed = false
  for (const fact of input.memory.facts) {
    await env.DB.prepare(
      `INSERT INTO user_profiles (user_id, ${fact.field}, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         ${fact.field} = excluded.${fact.field},
         updated_at = excluded.updated_at`,
    )
      .bind(input.userId, fact.value, timestamp)
      .run()
    changed = true
  }

  const rows = latestMemoryRows(input.memory)

  for (const row of rows) {
    const id = crypto.randomUUID()
    const existingRows = await env.DB.prepare(
      "SELECT id FROM memories WHERE user_id = ? AND type = ?",
    )
      .bind(input.userId, row.type)
      .all<{ id: string }>()
      .then((result) => result.results ?? [])

    await env.DB.prepare("DELETE FROM memories WHERE user_id = ? AND type = ?")
      .bind(input.userId, row.type)
      .run()
    for (const existing of existingRows) {
      await deleteMemoryVector(env, existing.id)
    }

    await env.DB.prepare(
      `INSERT INTO memories (id, user_id, conversation_id, type, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.userId,
        input.conversationId,
        row.type,
        row.content,
        timestamp,
      )
      .run()
    await upsertMemoryVector(env, {
      id,
      userId: input.userId,
      conversationId: input.conversationId,
      type: row.type,
      content: row.content,
      createdAt: timestamp,
    })
    changed = true
  }

  if (changed) {
    await invalidateLongTermMemoryCache(env, input.userId)
  }
}

function summarizeMessages(messages: ChatMessage[]) {
  const userLines = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
  const latest = userLines.slice(-5).join("；")
  return latest ? `这段对话主要围绕：${latest}` : "这段对话暂无明确主题。"
}

export async function maybeSaveConversationSummary(
  env: Env,
  input: {
    userId: string
    conversationId: string
    messages: ChatMessage[]
    windowSize?: number
  },
) {
  const enabled = await isLongTermMemoryEnabled(env, input.userId)
  if (!enabled) return

  const windowSize = input.windowSize ?? 20
  if (input.messages.length < windowSize) return

  const latestSummary = await env.DB.prepare(
    `SELECT end_time AS endTime
     FROM conversation_summaries
     WHERE user_id = ? AND conversation_id = ?
     ORDER BY end_time DESC
     LIMIT 1`,
  )
    .bind(input.userId, input.conversationId)
    .first<{ endTime: number }>()

  const unsummarized = latestSummary
    ? input.messages.filter(
        (message) => message.created_at > latestSummary.endTime,
      )
    : input.messages
  if (unsummarized.length < windowSize) return

  const window = unsummarized.slice(-windowSize)
  await env.DB.prepare(
    `INSERT INTO conversation_summaries (
       id,
       user_id,
       conversation_id,
       summary,
       start_time,
       end_time,
       message_count,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      input.userId,
      input.conversationId,
      summarizeMessages(window),
      window[0].created_at,
      window[window.length - 1].created_at,
      window.length,
      now(),
    )
    .run()
  await invalidateLongTermMemoryCache(env, input.userId)
}
