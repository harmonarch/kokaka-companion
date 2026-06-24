import type { Env } from "@/env"
import type { LongTermMemoryProfile } from "@/agent/memory/longTermMemory"
import { understandMemoryQuery } from "@/agent/memory/queryUnderstanding"
import { queryMemoryVectors } from "@/agent/memory/vectorMemory"

type RetrievalSource =
  | "structured"
  | "summary_time_range"
  | "keyword"
  | "semantic"

export type MemorySearchResult = {
  id: string
  source: RetrievalSource
  content: string
  score: number
  createdAt: number
  validFrom: number | null
  validTo: number | null
}

export type MemorySearchContext = {
  query: string
  keywords: string[]
  results: MemorySearchResult[]
}

const sourceWeights: Record<RetrievalSource, number> = {
  structured: 1.2,
  semantic: 1,
  summary_time_range: 0.9,
  keyword: 0.85,
}

const profileLabels: Record<
  keyof Omit<LongTermMemoryProfile, "userId" | "updatedAt">,
  string
> = {
  name: "姓名",
  birthday: "生日",
  occupation: "职业",
  company: "当前公司",
  location: "所在地",
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "")
}

function textSimilarity(a: string, b: string) {
  const left = new Set([...normalizeText(a)])
  const right = new Set([...normalizeText(b)])
  if (left.size === 0 && right.size === 0) return 1
  const intersection = [...left].filter((item) => right.has(item)).length
  const union = new Set([...left, ...right]).size
  return union === 0 ? 0 : intersection / union
}

function recencyBoost(createdAt: number, now = Date.now()) {
  const age = now - createdAt
  if (age <= 1000 * 60 * 60 * 24) return 1.1
  if (age <= 1000 * 60 * 60 * 24 * 7) return 1.05
  return 1
}

function rangeForQuery(query: string, now = Date.now()) {
  const day = 1000 * 60 * 60 * 24
  const end = now
  if (query.includes("半年前")) {
    const center = now - day * 182
    return { start: center - day * 31, end: center + day * 31 }
  }
  if (query.includes("去年")) {
    const date = new Date(now)
    const year = date.getUTCFullYear() - 1
    return {
      start: Date.UTC(year, 0, 1),
      end: Date.UTC(year, 11, 31, 23, 59, 59, 999),
    }
  }
  if (query.includes("昨天")) {
    return { start: end - day * 2, end: end - day }
  }
  if (query.includes("上周") || query.includes("最近一周")) {
    return { start: end - day * 7, end }
  }
  if (query.includes("最近") || query.includes("这段时间")) {
    return { start: end - day * 30, end }
  }
  return null
}

function yearRange(year: number) {
  return {
    start: Date.UTC(year, 0, 1),
    end: Date.UTC(year, 11, 31, 23, 59, 59, 999),
  }
}

function validDuring(
  result: { validFrom: number | null; validTo: number | null },
  range: { start: number; end: number } | null,
) {
  const validFrom = result.validFrom ?? Number.NEGATIVE_INFINITY
  const validTo = result.validTo ?? Number.POSITIVE_INFINITY
  if (range) return validFrom <= range.end && validTo >= range.start
  return validTo === Number.POSITIVE_INFINITY
}

function scoreResult(result: MemorySearchResult) {
  return {
    ...result,
    score:
      result.score *
      sourceWeights[result.source] *
      recencyBoost(result.createdAt),
  }
}

export function fuseMemoryResults(
  results: MemorySearchResult[],
  limit = 8,
): MemorySearchResult[] {
  const fused: MemorySearchResult[] = []
  for (const result of results
    .map(scoreResult)
    .sort((a, b) => b.score - a.score)) {
    const duplicateIndex = fused.findIndex(
      (item) => textSimilarity(item.content, result.content) >= 0.85,
    )
    if (duplicateIndex === -1) {
      fused.push(result)
      continue
    }
    if (result.score > fused[duplicateIndex].score) {
      fused[duplicateIndex] = result
    }
  }
  return fused.sort((a, b) => b.score - a.score).slice(0, limit)
}

function extractKeywords(query: string) {
  const titles =
    query
      .match(/《[^》]{1,40}》/g)
      ?.map((value) => value.trim())
      .filter(Boolean) ?? []
  const tokens =
    query
      .match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g)
      ?.flatMap((value) =>
        value.split(/(?:之前|记得|提到过|是不是|什么|时候|怎么)/),
      )
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
      .filter(
        (value) => !["之前", "记得", "什么", "怎么", "一个"].includes(value),
      ) ?? []

  return [...new Set([...titles, ...tokens])].slice(0, 5)
}

function detectTimeRange(query: string) {
  return rangeForQuery(query)
}

function hasMutableProfileTopic(query: string) {
  return /(职业|工作|公司|在哪|所在地|住哪|住在|住)/.test(query)
}

function hasLocationTimelineTopic(query: string) {
  return (
    /(在哪|所在地|住哪|住在|住|居住)/.test(query) &&
    /(去年|今年)/.test(query)
  )
}

function requestedLocationPeriods(query: string, now = Date.now()) {
  const year = new Date(now).getUTCFullYear()
  return [
    query.includes("去年")
      ? { label: "去年", marker: "去年", range: yearRange(year - 1) }
      : null,
    query.includes("今年")
      ? { label: "今年", marker: "今年", range: yearRange(year) }
      : null,
  ].filter(
    (
      period,
    ): period is {
      label: "去年" | "今年"
      marker: string
      range: { start: number; end: number }
    } => period !== null,
  )
}

function cleanLocation(value: string) {
  return value
    .trim()
    .replace(/(?:居住|生活|住着|住|了)+$/g, "")
    .replace(/[，,。！？!?；;\s].*$/g, "")
}

function isConcreteLocation(value: string) {
  return value.length >= 2 && !/(去年|今年|某个|地方|哪里|哪儿)/.test(value)
}

function locationFromMemoryContent(content: string) {
  const match =
    content.match(/所在地是([^，,。！？!?；;\s]+)/) ??
    content.match(/住在([^，,。！？!?；;\s]+)/) ??
    content.match(/搬到([^，,。！？!?；;\s]+)/) ??
    content.match(/居住在([^，,。！？!?；;\s]+)/)
  if (!match) return null
  const location = cleanLocation(match[1])
  return isConcreteLocation(location) ? location : null
}

function formatProfileResults(
  profile: LongTermMemoryProfile | null,
  query: string,
) {
  if (!profile) return []
  return (Object.keys(profileLabels) as Array<keyof typeof profileLabels>)
    .filter((field) => profile[field])
    .filter(
      (field) =>
        query.includes(profileLabels[field]) ||
        query.includes(field) ||
        query.includes(String(profile[field])),
    )
    .map(
      (field): MemorySearchResult => ({
        id: `profile:${field}`,
        source: "structured",
        content: `${profileLabels[field]}：${profile[field]}`,
        score: 1,
        createdAt: profile.updatedAt,
        validFrom: profile.updatedAt,
        validTo: null,
      }),
    )
}

export async function searchStructuredMemory(
  env: Env,
  userId: string,
  query: string,
) {
  if (rangeForQuery(query) && hasMutableProfileTopic(query)) return []
  const profile = await env.DB.prepare(
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
    .first<LongTermMemoryProfile>()
  return formatProfileResults(profile ?? null, query)
}

export async function searchTimelineLocationMemory(
  env: Env,
  userId: string,
  query: string,
) {
  if (!hasLocationTimelineTopic(query)) return []
  const periods = requestedLocationPeriods(query)
  if (periods.length === 0) return []

  const [profile, rows] = await Promise.all([
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
      `SELECT
        id,
        type,
        content,
        created_at AS createdAt,
        valid_from AS validFrom,
        valid_to AS validTo
       FROM memories
       WHERE user_id = ?
         AND type = 'event'
         AND (
           content LIKE '%所在地%'
           OR content LIKE '%住%'
           OR content LIKE '%搬到%'
           OR content LIKE '%居住%'
         )
       ORDER BY created_at DESC
       LIMIT 50`,
    )
      .bind(userId)
      .all<{
        id: string
        type: string
        content: string
        createdAt: number
        validFrom: number | null
        validTo: number | null
      }>(),
  ])

  const memories = rows.results ?? []
  const results: MemorySearchResult[] = []

  for (const period of periods) {
    if (period.label === "今年" && profile?.location) {
      results.push({
        id: "profile:location:this-year",
        source: "structured",
        content: "今年所在地：" + profile.location,
        score: 1.1,
        createdAt: profile.updatedAt,
        validFrom: profile.updatedAt,
        validTo: null,
      })
      continue
    }

    const memory = memories.find((item) => {
      if (!locationFromMemoryContent(item.content)) return false
      return (
        item.content.includes(period.marker) || validDuring(item, period.range)
      )
    })
    if (!memory) continue
    const location = locationFromMemoryContent(memory.content)
    if (!location) continue
    results.push({
      id: `timeline-location:${period.label}:${memory.id}`,
      source: "structured",
      content: `${period.label}所在地：${location}`,
      score: 1.05,
      createdAt: memory.createdAt,
      validFrom: memory.validFrom,
      validTo: memory.validTo,
    })
  }

  return results
}

export async function searchKeywordMemory(
  env: Env,
  userId: string,
  query: string,
) {
  const keywords = extractKeywords(query)
  if (keywords.length === 0) return []
  const range = rangeForQuery(query)
  const results: MemorySearchResult[] = []
  for (const keyword of keywords) {
    const rows = range
      ? await env.DB.prepare(
          `SELECT
             id,
             type,
             content,
             created_at AS createdAt,
             valid_from AS validFrom,
             valid_to AS validTo
           FROM memories
           WHERE user_id = ?
             AND content LIKE ?
             AND COALESCE(valid_from, -9223372036854775808) <= ?
             AND COALESCE(valid_to, 9223372036854775807) >= ?
           ORDER BY created_at DESC
           LIMIT 5`,
        )
          .bind(userId, `%${keyword}%`, range.end, range.start)
          .all<{
            id: string
            type: string
            content: string
            createdAt: number
            validFrom: number | null
            validTo: number | null
          }>()
      : await env.DB.prepare(
          `SELECT
             id,
             type,
             content,
             created_at AS createdAt,
             valid_from AS validFrom,
             valid_to AS validTo
           FROM memories
           WHERE user_id = ?
             AND content LIKE ?
             AND valid_to IS NULL
           ORDER BY created_at DESC
           LIMIT 5`,
        )
          .bind(userId, `%${keyword}%`)
          .all<{
            id: string
            type: string
            content: string
            createdAt: number
            validFrom: number | null
            validTo: number | null
          }>()
    results.push(
      ...(rows.results ?? []).map((row) => ({
        id: row.id,
        source: "keyword" as const,
        content: `[${row.type}] ${row.content}`,
        score: 0.85,
        createdAt: row.createdAt,
        validFrom: row.validFrom,
        validTo: row.validTo,
      })),
    )
  }
  return results
}

export async function searchTimeRangeSummaries(
  env: Env,
  userId: string,
  query: string,
) {
  const range = detectTimeRange(query)
  if (!range) return []
  const rows = await env.DB.prepare(
    `SELECT id, summary, end_time AS endTime
     FROM conversation_summaries
     WHERE user_id = ? AND end_time >= ? AND end_time <= ?
     ORDER BY end_time DESC
     LIMIT 5`,
  )
    .bind(userId, range.start, range.end)
    .all<{
      id: string
      summary: string
      endTime: number
    }>()
  return (rows.results ?? []).map(
    (row): MemorySearchResult => ({
      id: row.id,
      source: "summary_time_range",
      content: `[summary] ${row.summary}`,
      score: 0.8,
      createdAt: row.endTime,
      validFrom: null,
      validTo: null,
    }),
  )
}

export async function searchSemanticMemory(
  env: Env,
  userId: string,
  query: string,
) {
  const matches = await queryMemoryVectors(env, {
    userId,
    query,
    topK: 8,
  })
  const range = rangeForQuery(query)
  return matches
    .filter((match) => match.content)
    .filter((match) => validDuring(match, range))
    .map(
      (match): MemorySearchResult => ({
        id: match.id,
        source: "semantic",
        content: `[${match.type}] ${match.content}`,
        score: match.score,
        createdAt: match.createdAt,
        validFrom: match.validFrom,
        validTo: match.validTo,
      }),
    )
}

export async function searchHybridMemory(
  env: Env,
  input: {
    userId: string
    query: string
    limit?: number
  },
): Promise<MemorySearchContext> {
  const intent = await understandMemoryQuery(env, input.query)
  const [structured, timelineLocation, keyword, summaries, semantic] =
    await Promise.all([
      intent.wantsStructured
        ? searchStructuredMemory(env, input.userId, input.query)
        : Promise.resolve([]),
      searchTimelineLocationMemory(env, input.userId, input.query),
      searchKeywordMemory(env, input.userId, input.query),
      intent.wantsTimeRange
        ? searchTimeRangeSummaries(env, input.userId, input.query)
        : Promise.resolve([]),
      intent.wantsSemantic
        ? searchSemanticMemory(env, input.userId, input.query)
        : Promise.resolve([]),
    ])
  return {
    query: input.query,
    keywords: intent.keywords,
    results: fuseMemoryResults(
      [
        ...timelineLocation,
        ...structured,
        ...keyword,
        ...summaries,
        ...semantic,
      ],
      input.limit,
    ),
  }
}

export function formatHybridMemorySearch(context: MemorySearchContext) {
  if (context.results.length === 0) return "无"
  return context.results
    .map((result) => `[${result.source}] ${result.content}`)
    .join("\n")
}
