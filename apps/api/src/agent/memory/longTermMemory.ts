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
  forgets?: string[]
}

type MemoryType = "event" | "preference" | "emotion_snapshot"

type MemoryRow = {
  id: string
  type: string
  content: string
  createdAt: number
}

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
const internalEmotionLabels = new Set([
  "normal",
  "happy",
  "positive",
  "vulnerable",
  "crisis",
  "开心",
  "高兴",
  "正常",
])

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

function cleanMemoryContent(value: string) {
  return value
    .trim()
    .replace(/^用户(?:明确)?(?:提到|表示|说到|说|告诉我)?[:：\s]*/g, "")
    .replace(/[了啦呢啊呀。！？!?，,]+$/g, "")
}

function withUserPrefix(value: string) {
  const cleaned = cleanMemoryContent(value)
  if (!cleaned) return ""
  return cleaned.startsWith("用户") ? cleaned : `用户${cleaned}`
}

function hasSelfReference(value: string) {
  return /(^|[\s，,。！？!?])(我|我的|自己|本人|咱|咱们|我们)/.test(value)
}

function asksAboutAssistant(value: string) {
  const assistantRef = /(你|您|你们|助手|助理|模型|Kokaka|kokaka)/
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
  if (/^[你您]/.test(trimmed) && /[?？]$/.test(trimmed)) {
    return hasSelfReference(trimmed)
  }
  return true
}

function asksAboutUserMemory(value: string) {
  if (/你刚刚|刚刚那样|这样说|那样说/.test(value)) return false
  return (
    /[?？]/.test(value) ||
    /^(?:你)?(?:还)?(?:记得|知道|说说|讲讲|告诉我)/.test(value)
  ) && /(我|我的).*(喜欢|讨厌|不喜欢|叫什么|名字|生日|记忆)/.test(value)
}

function isOneOffRequest(value: string) {
  return /^(?:今晚|今天|明天|等会儿|一会儿|这次|刚刚|现在).*(?:想|要|去|吃|喝|买|看|试试)/.test(
    value,
  )
}

function isForgetRequest(value: string) {
  return /(忘掉|忘了|删掉|删除|别记|不要记|不用记)/.test(value)
}

function extractForgetTargets(value: string) {
  if (!isForgetRequest(value)) return []
  const normalized = cleanMemoryContent(
    value
      .replace(/请你/g, "")
      .replace(/记住/g, "")
      .replace(/(忘掉|忘了|删掉|删除|别记|不要记|不用记)/g, ""),
  )
  return normalized ? [withUserPrefix(normalized)] : []
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
    forgets?: unknown
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
  const forgets = Array.isArray(raw.forgets)
    ? uniq(raw.forgets.filter((forget): forget is string => typeof forget === "string"))
    : []

  return { facts, events, preferences, emotionSnapshot, forgets }
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
    forgets: memory.forgets?.filter(isUserSourced) ?? [],
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
    forgets:
      memory.forgets?.filter((forget) => hasUserSource(forget, userMessage)) ??
      [],
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
    forgets: uniq([...(fallback.forgets ?? []), ...(extracted.forgets ?? [])]),
  }
}

function contextBeforeCurrent(
  messages: ChatMessage[] | undefined,
  userMessage: string,
) {
  if (!messages) return []
  const lastCurrentIndex = messages
    .map((message) => message.content)
    .lastIndexOf(userMessage)
  return lastCurrentIndex >= 0 ? messages.slice(0, lastCurrentIndex) : messages
}

function titleFromText(value: string) {
  const explicit = value.match(/《([^》]{1,40})》/)?.[1]
  if (explicit) return `《${explicit}》`
  const loose = value.match(/(?:读|阅读|看)([\u4e00-\u9fa5A-Za-z0-9]{2,20})/)
    ?.[1]
  return loose ? `《${loose}》` : null
}

function directPreferenceFromText(value: string) {
  const text = value.trim()
  const preferences: string[] = []
  if (!canStoreUserUtterance(text) || asksAboutUserMemory(text)) return []
  if (isForgetRequest(text)) return []
  if (isOneOffRequest(text)) return []

  if (/工作学习时|工作学习的时候/.test(text) && /(咖啡|茶)/.test(text)) {
    const drink = text.includes("咖啡") ? "咖啡" : "茶"
    preferences.push(`工作学习时喝${drink}`)
  }

  if (/(?:每天|天天).{0,8}(?:咖啡|茶|奶茶)/.test(text)) {
    const drink = text.match(/(咖啡|茶|奶茶)/)?.[1]
    if (drink) preferences.push(`喜欢每天喝${drink}`)
  }

  if (/平时不喝太甜的奶茶/.test(text)) {
    preferences.push("平时不喝太甜的奶茶")
  }

  const noDrink = text.match(/(?:我)?不喝([\u4e00-\u9fa5A-Za-z0-9]{1,12})/)
  if (noDrink) preferences.push(`不喝${cleanFactValue(noDrink[1])}`)

  const noEat = text.match(/(?:我)?不吃([\u4e00-\u9fa5A-Za-z0-9]{1,12})/)
  if (noEat) preferences.push(`不吃${cleanFactValue(noEat[1])}`)

  const negative = text.match(
    /(?:我)?(?:不喜欢|讨厌|反感|不爱)([\u4e00-\u9fa5A-Za-z0-9《》、，,的太]{1,28})/,
  )
  if (negative) {
    preferences.push(`不喜欢${cleanFactValue(negative[1])}`)
  }

  const positive = text.match(
    /(?:我)?(?:一直|平时|每天|都|很|挺|真的|就是)?(?:喜欢|爱|偏爱)([\u4e00-\u9fa5A-Za-z0-9《》、，,的太不]{1,32})/,
  )
  if (
    positive &&
    !negative &&
    !/(这种感觉|这种状态|这样|那样)/.test(positive[1])
  ) {
    preferences.push(`喜欢${cleanFactValue(positive[1])}`)
  }

  const title = titleFromText(text)
  if (title && /(最近在读|正在读|喜欢读|喜欢阅读)/.test(text)) {
    preferences.push(`喜欢阅读${title}`)
  }

  return uniq(preferences.map(withUserPrefix))
}

function feelingPhraseFromUserText(value: string) {
  const matches = value.match(
    /[\u4e00-\u9fa5A-Za-z0-9、，,的在时]+(?:感觉|状态|氛围)/g,
  )
  const phrase = matches
    ?.map((item) => cleanFactValue(item))
    .filter((item) => !/(这种|这样|那样|什么)/.test(item))
    .sort((a, b) => b.length - a.length)[0]
  return phrase ?? null
}

function preferenceFromAssistantReply(value: string) {
  const text = value.trim()
  if (!text) return null
  if (/(肯定|夸|做得|不错|厉害|棒|替你高兴)/.test(text)) {
    return "用户喜欢被具体肯定"
  }
  if (/(理解|懂|听见|听到了|不用解释)/.test(text)) {
    return "用户喜欢被理解"
  }
  if (/(慢慢|不用急|陪你|在这里|别一个人)/.test(text)) {
    return "用户喜欢温和陪伴式回应"
  }
  if (/(具体|直接|清楚)/.test(text)) {
    return "用户喜欢具体清楚的回应"
  }
  return "用户喜欢 Kokaka 用具体、温和的方式回应"
}

function resolveContextualPreferences(
  userMessage: string,
  context?: ChatMessage[],
) {
  const text = userMessage.trim()
  if (!/(喜欢|爱|挺好|不错)/.test(text)) return []
  if (asksAboutUserMemory(text)) return []
  if (!/(这种感觉|这种状态|这种氛围|这样|那样|刚刚那样|你刚刚)/.test(text)) {
    return []
  }

  const previous = contextBeforeCurrent(context, userMessage)
  if (/你刚刚|刚刚那样|这样说|那样说/.test(text)) {
    const assistant = [...previous].reverse().find((message) => message.role === "agent")
    const preference = assistant ? preferenceFromAssistantReply(assistant.content) : null
    return preference ? [preference] : []
  }

  const user = [...previous].reverse().find((message) => message.role === "user")
  const phrase = user ? feelingPhraseFromUserText(user.content) : null
  return phrase ? [withUserPrefix(`喜欢${phrase}`)] : []
}

function extractLongTermEmotion(userMessage: string) {
  const text = userMessage.trim()
  if (
    !/(最近|一直|持续|这两周|两周|一段时间|长期|总是)/.test(text) ||
    !/(焦虑|难过|低落|害怕|压力|失眠|崩溃|烦躁)/.test(text)
  ) {
    return null
  }
  return withUserPrefix(`最近的持续情绪状态：${cleanMemoryContent(text)}`)
}

function normalizedMemory(value: string) {
  return normalizeForSourceCheck(value)
    .replace(/用户/g, "")
    .replace(/我/g, "")
    .replace(/的/g, "")
}

function preferencePolarity(value: string) {
  return /(不喜欢|讨厌|反感|不喝|不吃|不爱|不想)/.test(value)
    ? "negative"
    : "positive"
}

function preferenceObject(value: string) {
  const text = normalizedMemory(value)
  if (/咖啡/.test(text)) return "coffee"
  if (/奶茶/.test(text)) return "milk_tea"
  if (/茶/.test(text)) return "tea"
  if (/折耳根/.test(text)) return "zheergen"
  if (/烧烤/.test(text)) return "barbecue"
  if (/暖饮|甜饮/.test(text)) return "warm_drink"
  if (/(读书|阅读|思考快与慢)/.test(text)) return "reading"
  if (/(啤酒|红酒|白酒|酒精|喝酒|不喝酒|酒)/.test(text)) return "alcohol"
  return text.slice(0, 12)
}

function isContextSpecificPreference(value: string) {
  return /(工作学习时|工作学习的时候|早上|晚上|每天|平时|生日|读书时)/.test(
    value,
  )
}

function preferenceRelation(existing: string, incoming: string) {
  const existingNormalized = normalizedMemory(existing)
  const incomingNormalized = normalizedMemory(incoming)
  if (existingNormalized === incomingNormalized) return "duplicate"

  const sameObject = preferenceObject(existing) === preferenceObject(incoming)
  const samePolarity = preferencePolarity(existing) === preferencePolarity(incoming)
  if (sameObject && !samePolarity) return "conflict"

  if (sameObject && samePolarity) {
    if (
      !isContextSpecificPreference(existing) &&
      !isContextSpecificPreference(incoming) &&
      incoming.length > existing.length
    ) {
      return "update"
    }
    if (
      existingNormalized.includes(incomingNormalized) ||
      incomingNormalized.includes(existingNormalized) ||
      textSimilarity(existing, incoming) >= 0.82
    ) {
      if (
        isContextSpecificPreference(existing) !==
        isContextSpecificPreference(incoming)
      ) {
        return "independent"
      }
      return incoming.length > existing.length ? "update" : "duplicate"
    }
  }

  return "independent"
}

function textSimilarity(a: string, b: string) {
  const left = new Set([...normalizedMemory(a)])
  const right = new Set([...normalizedMemory(b)])
  if (left.size === 0 && right.size === 0) return 1
  const intersection = [...left].filter((item) => right.has(item)).length
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}

function isAllowedEmotionSnapshot(value: string | null) {
  if (!value) return false
  const cleaned = cleanMemoryContent(value)
  if (internalEmotionLabels.has(cleaned.toLowerCase())) return false
  if (internalEmotionLabels.has(cleaned)) return false
  if (cleaned.includes("关系事件")) return true
  return /(最近|持续|两周|一段时间|长期|总是)/.test(cleaned)
}

function prepareMemoryForStorage(
  memory: ExtractedLongTermMemory,
): ExtractedLongTermMemory {
  const events = uniq(
    memory.events
      .map((event) => withUserPrefix(event))
      .filter((event) => event.length >= 5)
      .filter((event) => !asksAboutUserMemory(event))
      .filter((event) => !isOneOffRequest(cleanMemoryContent(event))),
  )
  const preferences = uniq(
    memory.preferences
      .map((preference) => withUserPrefix(preference))
      .filter((preference) => preference.length >= 5)
      .filter((preference) => !asksAboutUserMemory(preference))
      .filter((preference) => !isOneOffRequest(cleanMemoryContent(preference))),
  )
  const emotionSnapshot = isAllowedEmotionSnapshot(memory.emotionSnapshot)
    ? withUserPrefix(memory.emotionSnapshot ?? "")
    : null
  const forgets = uniq((memory.forgets ?? []).map(withUserPrefix).filter(Boolean))

  return {
    facts: memory.facts,
    events,
    preferences,
    emotionSnapshot,
    ...(forgets.length > 0 ? { forgets } : {}),
  }
}

function memoryMatchesForgetTarget(memory: MemoryRow, target: string) {
  if (memory.type !== "preference" && memory.type !== "event") return false
  const relation =
    memory.type === "preference"
      ? preferenceRelation(memory.content, target)
      : textSimilarity(memory.content, target) >= 0.7
        ? "duplicate"
        : "independent"
  return relation !== "independent"
}

async function loadStoredMemories(env: Env, userId: string) {
  const result = await env.DB.prepare(
    `SELECT id, type, content, created_at AS createdAt
     FROM memories
     WHERE user_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<MemoryRow>()
  return result.results ?? []
}

async function deleteStoredMemory(env: Env, userId: string, id: string) {
  await env.DB.prepare("DELETE FROM memories WHERE user_id = ? AND id = ?")
    .bind(userId, id)
    .run()
  await deleteMemoryVector(env, id)
}

async function insertStoredMemory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    type: MemoryType
    content: string
    createdAt: number
  },
) {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO memories (id, user_id, conversation_id, type, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.userId,
      input.conversationId,
      input.type,
      input.content,
      input.createdAt,
    )
    .run()
  await upsertMemoryVector(env, {
    id,
    userId: input.userId,
    conversationId: input.conversationId,
    type: input.type,
    content: input.content,
    createdAt: input.createdAt,
  })
  return id
}

async function updateStoredMemory(
  env: Env,
  input: {
    userId: string
    conversationId: string
    id: string
    type: string
    content: string
    createdAt: number
  },
) {
  await env.DB.prepare(
    `UPDATE memories
     SET content = ?, created_at = ?
     WHERE user_id = ? AND id = ?`,
  )
    .bind(input.content, input.createdAt, input.userId, input.id)
    .run()
  await upsertMemoryVector(env, {
    id: input.id,
    userId: input.userId,
    conversationId: input.conversationId,
    type: input.type,
    content: input.content,
    createdAt: input.createdAt,
  })
}

async function storeMemoryBySemanticRelation(
  env: Env,
  input: {
    userId: string
    conversationId: string
    existing: MemoryRow[]
    type: MemoryType
    content: string
    createdAt: number
  },
) {
  const sameType = input.existing.filter((memory) => memory.type === input.type)
  for (const memory of sameType) {
    const relation =
      input.type === "preference"
        ? preferenceRelation(memory.content, input.content)
        : textSimilarity(memory.content, input.content) >= 0.85
          ? input.content.length > memory.content.length
            ? "update"
            : "duplicate"
          : "independent"

    if (relation === "duplicate") return false
    if (relation === "update") {
      await updateStoredMemory(env, {
        userId: input.userId,
        conversationId: input.conversationId,
        id: memory.id,
        type: memory.type,
        content: input.content,
        createdAt: input.createdAt,
      })
      memory.content = input.content
      memory.createdAt = input.createdAt
      return true
    }
    if (relation === "conflict") {
      await deleteStoredMemory(env, input.userId, memory.id)
      const index = input.existing.findIndex((item) => item.id === memory.id)
      if (index >= 0) input.existing.splice(index, 1)
    }
  }

  const id = await insertStoredMemory(env, input)
  input.existing.unshift({
    id,
    type: input.type,
    content: input.content,
    createdAt: input.createdAt,
  })
  return true
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
  context?: ChatMessage[],
): ExtractedLongTermMemory {
  const facts: ExtractedFact[] = []
  const events: string[] = []
  const preferences: string[] = directPreferenceFromText(userMessage)
  const forgets: string[] = extractForgetTargets(userMessage)
  const text = userMessage.trim()
  const canStoreText = canStoreUserUtterance(text)

  if (!canStoreText || asksAboutUserMemory(text)) {
    return {
      facts,
      events,
      preferences: [],
      emotionSnapshot: null,
      ...(forgets.length > 0 ? { forgets } : {}),
    }
  }

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

  preferences.push(...resolveContextualPreferences(text, context))

  if (
    canStoreText &&
    /(被裁|分手|离职|换工作|入职|面试|吵架|搬家|生病|住院|毕业|结婚)/.test(text)
  ) {
    events.push(`用户提到重要事件：${text}`)
  }
  const finishedTitle = titleFromText(text)
  if (finishedTitle && /(读完|看完|读完了|看完了)/.test(text)) {
    events.push(`用户读完了${finishedTitle}`)
  }

  return {
    facts,
    events: uniq(events),
    preferences: uniq(preferences),
    emotionSnapshot: extractLongTermEmotion(text) ?? emotionSnapshot,
    ...(forgets.length > 0 ? { forgets } : {}),
  }
}

export async function extractLongTermMemory(
  env: Env,
  input: {
    userMessage: string
    reply: string
    emotionState: string
    relationshipSnapshot?: string | null
    context?: ChatMessage[]
  },
): Promise<ExtractedLongTermMemory> {
  const canStoreText = canStoreUserUtterance(input.userMessage)
  if (!canStoreText) return emptyExtraction

  const fallback = heuristicExtractLongTermMemory(
    input.userMessage,
    null,
    input.context,
  )
  const fallbackWithRelationship = input.relationshipSnapshot
    ? {
        ...fallback,
        emotionSnapshot:
          fallback.emotionSnapshot ?? input.relationshipSnapshot,
      }
    : fallback
  if (!env.DEEPSEEK_API_KEY) return fallbackWithRelationship

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
                '{"facts":[{"field":"name|birthday|occupation|company|location","value":"..."}],"events":["..."],"preferences":["..."],"emotionSnapshot":"...或null","forgets":["..."]}',
                "只提取用户主动透露的个人事实、重大生活事件、明确偏好和明显情绪。",
                "可以使用上下文解析“这种感觉/这样/刚刚那样”等指代，但必须是用户明确说喜欢。",
                "不要补充、推测或使用助手单方面表达过的信息。",
                "忽略闲聊、一次性请求和无法确认的信息。",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                `最近上下文：${(input.context ?? [])
                  .slice(-6)
                  .map((message) => `${message.role}: ${message.content}`)
                  .join("\n")}`,
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
    if (!response.ok) return fallbackWithRelationship
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return fallbackWithRelationship
    return mergeExtractions(
      fallbackWithRelationship,
      keepUserSupportedMemory(
        removeAssistantSourcedMemory(normalizeExtraction(parseJsonObject(content))),
        input.userMessage,
      ),
    )
  } catch {
    return fallbackWithRelationship
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

  const memory = prepareMemoryForStorage(input.memory)
  const timestamp = now()
  let changed = false
  for (const fact of memory.facts) {
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

  const existing = await loadStoredMemories(env, input.userId)
  for (const forget of memory.forgets ?? []) {
    for (const stored of [...existing]) {
      if (!memoryMatchesForgetTarget(stored, forget)) continue
      await deleteStoredMemory(env, input.userId, stored.id)
      const index = existing.findIndex((item) => item.id === stored.id)
      if (index >= 0) existing.splice(index, 1)
      changed = true
    }
  }

  const rows: Array<{ type: MemoryType; content: string }> = [
    ...memory.events.map((content) => ({ type: "event" as const, content })),
    ...memory.preferences.map((content) => ({
      type: "preference" as const,
      content,
    })),
    ...(memory.emotionSnapshot
      ? [{ type: "emotion_snapshot" as const, content: memory.emotionSnapshot }]
      : []),
  ]

  for (const row of rows) {
    const rowChanged = await storeMemoryBySemanticRelation(env, {
      userId: input.userId,
      conversationId: input.conversationId,
      existing,
      type: row.type,
      content: row.content,
      createdAt: timestamp,
    })
    changed = rowChanged || changed
  }

  if (changed) {
    await invalidateLongTermMemoryCache(env, input.userId)
  }
}

function summarizeMessages(messages: ChatMessage[]) {
  const userLines = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((line) => hasLongTermSummaryValue(line))
  const latest = userLines.slice(-5).join("；")
  return latest ? `这段对话主要围绕：${latest}` : "这段对话暂无明确主题。"
}

function hasLongTermSummaryValue(value: string) {
  if (!canStoreUserUtterance(value)) return false
  if (asksAboutUserMemory(value) || isOneOffRequest(value)) return false
  if (/^(hello|hi|嗨|晚上好|早上好|好|可以|爱你|想你|111|1)$/i.test(value)) {
    return false
  }
  return /(?:我叫|生日|我是|我的工作|公司|入职|离职|换工作|被裁|分手|结婚|毕业|搬家|生病|住院|最近.*焦虑|持续.*焦虑|一直.*压力|喜欢|不喜欢|讨厌|不喝|不吃|读完|最近在读)/.test(
    value,
  )
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
  const summary = summarizeMessages(window)
  if (summary === "这段对话暂无明确主题。") return

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
      summary,
      window[0].created_at,
      window[window.length - 1].created_at,
      window.length,
      now(),
    )
    .run()
  await invalidateLongTermMemoryCache(env, input.userId)
}
