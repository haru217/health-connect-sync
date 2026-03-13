import { DEFAULT_LLM_PROVIDER } from '../constants'
import { WEEKLY_REPORT_MAX_CHARS, WEEKLY_REPORT_MIN_CHARS, WEEKLY_REPORT_SYSTEM_PROMPT } from '../constants/weekly-report-prompt'
import type { D1Database, Env, ExecutionContext, WeeklyReportRow } from '../types'
import {
  execute,
  getLastCompletedWeekStart,
  getWeekStartMonday,
  isValidDate,
  jsonResponse,
  nowIso,
  parseBooleanFlag,
  queryAll,
  queryFirst,
  shiftIsoDateByDays,
} from '../utils'
import { getScores } from './scores'
import { ensureAggregatesUpToDate } from './sync-aggregate'
import {
  buildTrendRowsTable,
  callLlmPlainText,
  type DailyReportTrendRow,
  formatPromptInteger,
  formatPromptNumber,
  maskIncompleteIntake,
  readOptionalJsonBody,
  stripReportEmoji,
  queryDailyReportTrendRows,
} from './report'

interface WeeklyReportGenerationOptions {
  force?: boolean
  provider?: string
  apiKey?: string
  model?: string
}

interface WeeklyScorePromptRow {
  date: string
  score: Record<string, unknown>
}

interface BuildWeeklyUserPromptOptions {
  weekStart: string
  weekEnd: string
  trendRows: DailyReportTrendRow[]
  scoreRows: WeeklyScorePromptRow[]
}

interface WeeklyReportGenerationResult {
  week_start: string
  generated: boolean
  cached: boolean
  generated_at?: string
  reason?: 'insufficient_data'
}

function buildWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftIsoDateByDays(weekStart, index))
}

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(1, parsed))
}

function parseOffset(value: string | null): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function hasAnyDayData(row: DailyReportTrendRow | undefined): boolean {
  if (!row) {
    return false
  }
  const values = [
    row.steps,
    row.sleep_hours,
    row.weight_kg,
    row.body_fat_pct,
    row.blood_systolic,
    row.blood_diastolic,
    row.active_kcal,
    row.total_kcal,
    row.intake_kcal,
    row.protein_g,
    row.fat_g,
    row.carbs_g,
  ]
  return values.some((value) => value != null && Number.isFinite(value))
}

function withoutNutritionDomain(score: Record<string, unknown>): Record<string, unknown> {
  const rawDomains = score.domains
  if (!rawDomains || typeof rawDomains !== 'object' || Array.isArray(rawDomains)) {
    return { ...score }
  }
  const domains = rawDomains as Record<string, unknown>
  return {
    ...score,
    domains: Object.fromEntries(Object.entries(domains).filter(([key]) => key !== 'nutrition')),
  }
}

function buildWeeklyReportHeadline(report: string): string {
  const stripped = stripReportEmoji(report).replace(/【.+?】/g, '').replace(/\n+/g, ' ').trim()
  const firstSentence = stripped.split('。').map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  if (!firstSentence) {
    return 'ハルの週次レポート'
  }
  return firstSentence.length <= 30 ? firstSentence : `${firstSentence.slice(0, 30)}…`
}

function toWeeklyReportResponse(row: WeeklyReportRow): Record<string, unknown> {
  return {
    week_start: row.week_start,
    week_end: row.week_end,
    headline: row.headline,
    report: row.report,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    generated_at: row.generated_at,
    created_at: row.created_at,
  }
}

async function getWeeklyReport(db: D1Database, weekStart: string): Promise<WeeklyReportRow | null> {
  return queryFirst<WeeklyReportRow>(
    db,
    `
    SELECT
      week_start, week_end, headline, report, model,
      prompt_tokens, completion_tokens, generated_at, created_at
    FROM weekly_reports
    WHERE week_start = ?
    LIMIT 1
    `,
    [weekStart],
  )
}

function computeWeekAverage(
  rows: DailyReportTrendRow[],
  weekDates: string[],
): Record<string, string> {
  const rowMap = new Map(rows.map((r) => [r.date, r]))
  const weekRows = weekDates.map((d) => rowMap.get(d)).filter((r): r is DailyReportTrendRow => r != null)
  const avgWithCount = (values: (number | null | undefined)[], digits: number): string => {
    const valid = values.filter((v): v is number => v != null && Number.isFinite(v))
    if (valid.length === 0) return '-'
    const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length
    const formatted = digits === 0 ? String(Math.round(mean)) : mean.toFixed(digits)
    return `${formatted}(${valid.length}d)`
  }
  return {
    steps: avgWithCount(weekRows.map((r) => r.steps), 0),
    sleep_h: avgWithCount(weekRows.map((r) => r.sleep_hours), 1),
    weight: avgWithCount(weekRows.map((r) => r.weight_kg), 1),
    fat_pct: avgWithCount(weekRows.map((r) => r.body_fat_pct), 1),
    active_burn_kcal: avgWithCount(weekRows.map((r) => r.active_kcal), 0),
    total_burn_kcal: avgWithCount(weekRows.map((r) => r.total_kcal), 0),
    intake_kcal: avgWithCount(weekRows.map((r) => r.intake_kcal), 0),
    protein_g: avgWithCount(weekRows.map((r) => r.protein_g), 1),
    fat_g: avgWithCount(weekRows.map((r) => r.fat_g), 1),
    carbs_g: avgWithCount(weekRows.map((r) => r.carbs_g), 1),
  }
}

export function buildWeeklyUserPrompt(options: BuildWeeklyUserPromptOptions): string {
  const maskedTrendRows = maskIncompleteIntake(options.trendRows)
  const trendTable = buildTrendRowsTable(options.weekEnd, maskedTrendRows)
  const weekDates = buildWeekDates(options.weekStart)
  const prevWeekDates = buildWeekDates(shiftIsoDateByDays(options.weekStart, -7))

  const thisWeekAvg = computeWeekAverage(maskedTrendRows, weekDates)
  const prevWeekAvg = computeWeekAverage(maskedTrendRows, prevWeekDates)

  const hasAnyIntake = thisWeekAvg.intake_kcal !== '-'
  const avgSection = [
    '# 週平均の比較（各値は「平均値(データ日数)」形式。レポートではこの平均値を使って語ること）',
    '| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal |' + (hasAnyIntake ? ' intake_kcal | protein | fat | carbs |' : ''),
    `| 今週 | ${thisWeekAvg.steps} | ${thisWeekAvg.sleep_h} | ${thisWeekAvg.weight} | ${thisWeekAvg.fat_pct} | ${thisWeekAvg.active_burn_kcal} | ${thisWeekAvg.total_burn_kcal}` + (hasAnyIntake ? ` | ${thisWeekAvg.intake_kcal} | ${thisWeekAvg.protein_g} | ${thisWeekAvg.fat_g} | ${thisWeekAvg.carbs_g} |` : ' |'),
    `| 前週 | ${prevWeekAvg.steps} | ${prevWeekAvg.sleep_h} | ${prevWeekAvg.weight} | ${prevWeekAvg.fat_pct} | ${prevWeekAvg.active_burn_kcal} | ${prevWeekAvg.total_burn_kcal}` + (hasAnyIntake ? ` | ${prevWeekAvg.intake_kcal} | ${prevWeekAvg.protein_g} | ${prevWeekAvg.fat_g} | ${prevWeekAvg.carbs_g} |` : ' |'),
  ]

  return [
    `# 週次レポート: ${options.weekStart}〜${options.weekEnd}`,
    '',
    ...avgSection,
    '',
    '# 14日間の日別データ（傾向把握用。レポートでは日別数値を列挙せず、上記の平均で語ること）',
    `${trendTable.header}\n${trendTable.body}`,
    '',
    '# 対象週のスコア推移（日別）',
    JSON.stringify(options.scoreRows),
  ].join('\n')
}

export async function generateWeeklyReport(
  env: Env,
  weekStart: string,
  options: WeeklyReportGenerationOptions = {},
): Promise<WeeklyReportGenerationResult> {
  const normalizedWeekStart = getWeekStartMonday(weekStart)
  const weekEnd = shiftIsoDateByDays(normalizedWeekStart, 6)
  const force = options.force ?? false

  const cached = await getWeeklyReport(env.DB, normalizedWeekStart)
  if (cached && !force) {
    return {
      week_start: normalizedWeekStart,
      generated: false,
      cached: true,
      generated_at: cached.generated_at,
    }
  }

  await ensureAggregatesUpToDate(env.DB)
  const trendRows = await queryDailyReportTrendRows(env.DB, weekEnd)
  const weekDates = buildWeekDates(normalizedWeekStart)
  const sourceRowMap = new Map(trendRows.map((row) => [row.date, row]))
  const noDataDays = weekDates.filter((date) => !hasAnyDayData(sourceRowMap.get(date))).length
  if (noDataDays >= 3) {
    return {
      week_start: normalizedWeekStart,
      generated: false,
      cached: false,
      reason: 'insufficient_data',
    }
  }

  const maskedTrendRows = maskIncompleteIntake(trendRows)
  const maskedRowMap = new Map(maskedTrendRows.map((row) => [row.date, row]))
  const scoreRows = await Promise.all(
    weekDates.map(async (date) => {
      const rawScore = await getScores(env.DB, date)
      const hideNutrition = maskedRowMap.get(date)?.intake_kcal == null
      const safeScore = hideNutrition ? withoutNutritionDomain(rawScore as Record<string, unknown>) : rawScore
      return { date, score: safeScore as Record<string, unknown> }
    }),
  )
  const userPrompt = buildWeeklyUserPrompt({
    weekStart: normalizedWeekStart,
    weekEnd,
    trendRows,
    scoreRows,
  })

  const envProvider = (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim().toLowerCase() || DEFAULT_LLM_PROVIDER
  const overrideApiKey = options.apiKey?.trim() ?? ''
  const envApiKey = (env.LLM_API_KEY ?? '').trim()
  const geminiApiKey = (env.GEMINI_API_KEY ?? '').trim()
  let provider: string
  let effectiveApiKey: string
  if (overrideApiKey) {
    effectiveApiKey = overrideApiKey
    provider = options.provider?.trim().toLowerCase() || envProvider
  } else if (envApiKey) {
    effectiveApiKey = envApiKey
    provider = options.provider?.trim().toLowerCase() || envProvider
  } else if (geminiApiKey) {
    effectiveApiKey = geminiApiKey
    provider = 'gemini'
  } else {
    throw new Error('LLM API key is not configured')
  }
  const overrideModel = options.model?.trim() ?? ''
  const model = overrideModel || (env.LLM_MODEL ?? '').trim() || ''

  const generated = await callLlmPlainText(provider, effectiveApiKey, model, WEEKLY_REPORT_SYSTEM_PROMPT, userPrompt, {
    minChars: WEEKLY_REPORT_MIN_CHARS,
    maxChars: WEEKLY_REPORT_MAX_CHARS,
    forbidToday: false,
  })
  const generatedAt = nowIso()
  await execute(
    env.DB,
    `
    INSERT INTO weekly_reports(
      week_start, week_end, headline, report, model,
      prompt_tokens, completion_tokens, generated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(week_start) DO UPDATE SET
      week_end = excluded.week_end,
      headline = excluded.headline,
      report = excluded.report,
      model = excluded.model,
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      generated_at = excluded.generated_at
    `,
    [
      normalizedWeekStart,
      weekEnd,
      buildWeeklyReportHeadline(generated.text),
      generated.text,
      generated.model,
      generated.prompt_tokens,
      generated.completion_tokens,
      generatedAt,
    ],
  )

  return {
    week_start: normalizedWeekStart,
    generated: true,
    cached: false,
    generated_at: generatedAt,
  }
}

export async function handleWeeklyReportGet(url: URL, env: Env): Promise<Response> {
  const requestedWeekStart = url.searchParams.get('week_start') ?? getLastCompletedWeekStart()
  if (!isValidDate(requestedWeekStart)) {
    return jsonResponse({ detail: 'week_start query must be YYYY-MM-DD' }, 400)
  }
  const weekStart = getWeekStartMonday(requestedWeekStart)
  const row = await getWeeklyReport(env.DB, weekStart)
  if (!row) {
    return jsonResponse({ detail: 'Weekly report not found' }, 404)
  }
  return jsonResponse(toWeeklyReportResponse(row))
}

export async function handleWeeklyReportsListGet(url: URL, env: Env): Promise<Response> {
  const limit = parseLimit(url.searchParams.get('limit'), 10)
  const offset = parseOffset(url.searchParams.get('offset'))
  const rows = await queryAll<WeeklyReportRow>(
    env.DB,
    `
    SELECT
      week_start, week_end, headline, report, model,
      prompt_tokens, completion_tokens, generated_at, created_at
    FROM weekly_reports
    ORDER BY week_start DESC
    LIMIT ? OFFSET ?
    `,
    [limit, offset],
  )
  return jsonResponse({
    reports: rows.map(toWeeklyReportResponse),
  })
}

export async function handleWeeklyReportGenerate(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const envLlmApiKey = (env.LLM_API_KEY ?? '').trim()
  const geminiApiKey = (env.GEMINI_API_KEY ?? '').trim()
  if (!envLlmApiKey && !geminiApiKey) {
    return jsonResponse({ detail: 'LLM API key is not configured' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await readOptionalJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  const bodyWeekStart = body.week_start
  if (bodyWeekStart != null && typeof bodyWeekStart !== 'string') {
    return jsonResponse({ detail: 'week_start must be YYYY-MM-DD' }, 400)
  }
  const requestedWeekStart = (bodyWeekStart as string | null) ?? url.searchParams.get('week_start') ?? getLastCompletedWeekStart()
  if (!isValidDate(requestedWeekStart)) {
    return jsonResponse({ detail: 'week_start must be YYYY-MM-DD' }, 400)
  }
  const weekStart = getWeekStartMonday(requestedWeekStart)

  const forceFromBody = parseBooleanFlag(body.force)
  const forceFromQuery = parseBooleanFlag(url.searchParams.get('force'))
  const force = forceFromBody ?? forceFromQuery ?? false

  const overrideProvider = typeof body.provider === 'string' ? body.provider : undefined
  const overrideApiKey = typeof body.api_key === 'string' ? body.api_key : undefined
  const overrideModel = typeof body.model === 'string' ? body.model : undefined

  let effectiveApiKey: string
  let effectiveProvider: string | undefined
  if (overrideApiKey) {
    effectiveApiKey = overrideApiKey
    effectiveProvider = overrideProvider
  } else if (overrideProvider === 'gemini' && geminiApiKey) {
    effectiveApiKey = geminiApiKey
    effectiveProvider = 'gemini'
  } else if (envLlmApiKey) {
    effectiveApiKey = envLlmApiKey
    effectiveProvider = overrideProvider
  } else if (geminiApiKey) {
    effectiveApiKey = geminiApiKey
    effectiveProvider = 'gemini'
  } else {
    return jsonResponse({ detail: 'LLM API key is not configured' }, 503)
  }

  const generatePromise = generateWeeklyReport(env, weekStart, {
    force,
    provider: effectiveProvider,
    apiKey: effectiveApiKey,
    model: overrideModel,
  })

  try {
    const result = await generatePromise
    return jsonResponse({ ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate weekly report'
    return jsonResponse({ detail: message }, 500)
  }
}
