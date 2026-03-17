import { DEFAULT_LLM_PROVIDER } from '../constants'
import {
  MONTHLY_REPORT_MAX_CHARS,
  MONTHLY_REPORT_MIN_CHARS,
  MONTHLY_REPORT_SYSTEM_PROMPT,
} from '../constants/monthly-report-prompt'
import type { D1Database, Env, MonthlyReportRow } from '../types'
import {
  execute,
  getLastCompletedMonth,
  isValidMonth,
  jsonResponse,
  monthEndDate,
  monthStartDate,
  nowIso,
  parseBooleanFlag,
  queryAll,
  queryFirst,
  shiftIsoDateByDays,
  shiftYearMonth,
} from '../utils'
import { checkMonthlyLimit, recordGeminiUsage } from './gemini-usage'
import { getScores } from './scores'
import { ensureAggregatesUpToDate } from './sync-aggregate'
import {
  callLlmPlainText,
  type DailyReportTrendRow,
  formatPromptInteger,
  formatPromptNumber,
  maskIncompleteIntake,
  readOptionalJsonBody,
  stripReportEmoji,
} from './report'

interface MonthlyReportGenerationOptions {
  force?: boolean
  provider?: string
  apiKey?: string
  model?: string
}

interface MonthlyReportGenerationResult {
  month: string
  generated: boolean
  cached: boolean
  generated_at?: string
  reason?: 'insufficient_data'
}

interface MonthlyPromptAverageRow {
  steps: string
  sleep_h: string
  weight: string
  fat_pct: string
  active_burn_kcal: string
  total_burn_kcal: string
  intake_kcal: string
  protein_g: string
  fat_g: string
  carbs_g: string
}

interface MonthlyScoreSummary {
  overall: number | null
  sleep: number | null
  activity: number | null
  nutrition: number | null
  condition: number | null
}

interface MonthlyScoreDailyRow {
  date: string
  score: MonthlyScoreSummary
}

interface MonthlyScorePromptRow {
  period: string
  score: MonthlyScoreSummary | Omit<MonthlyScoreSummary, 'nutrition'>
}

interface BuildMonthlyUserPromptOptions {
  month: string
  thisMonthAverage: MonthlyPromptAverageRow
  prevMonthAverage: MonthlyPromptAverageRow
  quarterAverages: Array<{ period: string; average: MonthlyPromptAverageRow }>
  scoreRows: MonthlyScorePromptRow[]
}

class GeminiLimitExceededError extends Error {
  currentCostJpy: number
  limitJpy: number

  constructor(currentCostJpy: number, limitJpy: number) {
    super('Gemini API の月額上限に達しました。')
    this.name = 'GeminiLimitExceededError'
    this.currentCostJpy = currentCostJpy
    this.limitJpy = limitJpy
  }
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

function buildDateRange(startDate: string, endDate: string): string[] {
  if (startDate > endDate) {
    return []
  }
  const dates: string[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    dates.push(cursor)
    cursor = shiftIsoDateByDays(cursor, 1)
  }
  return dates
}

function buildMonthQuarterRanges(month: string): Array<{ period: string; dates: string[] }> {
  const lastDay = Number.parseInt(monthEndDate(month).slice(8, 10), 10)
  const ranges = [
    { period: '1-7日', start: 1, end: Math.min(7, lastDay) },
    { period: '8-14日', start: 8, end: Math.min(14, lastDay) },
    { period: '15-21日', start: 15, end: Math.min(21, lastDay) },
    { period: '22-末日', start: 22, end: lastDay },
  ].filter((range) => range.start <= range.end)

  return ranges.map((range) => {
    const startDate = `${month}-${String(range.start).padStart(2, '0')}`
    const endDate = `${month}-${String(range.end).padStart(2, '0')}`
    return {
      period: range.period,
      dates: buildDateRange(startDate, endDate),
    }
  })
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

function buildMonthlyReportHeadline(report: string): string {
  const stripped = stripReportEmoji(report).replace(/【.+?】/g, '').replace(/\n+/g, ' ').trim()
  const firstSentence = stripped.split('。').map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  if (!firstSentence) {
    return 'ハルの月次レポート'
  }
  return firstSentence.length <= 30 ? firstSentence : `${firstSentence.slice(0, 30)}…`
}

function toMonthlyReportResponse(row: MonthlyReportRow): Record<string, unknown> {
  return {
    month: row.month,
    headline: row.headline,
    report: row.report,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    generated_at: row.generated_at,
    created_at: row.created_at,
  }
}

async function getMonthlyReport(db: D1Database, month: string): Promise<MonthlyReportRow | null> {
  return queryFirst<MonthlyReportRow>(
    db,
    `
    SELECT
      month, headline, report, model,
      prompt_tokens, completion_tokens, generated_at, created_at
    FROM monthly_reports
    WHERE month = ?
    LIMIT 1
    `,
    [month],
  )
}

async function queryMonthlyTrendRows(
  db: D1Database,
  startDate: string,
  endDate: string,
): Promise<DailyReportTrendRow[]> {
  return queryAll<DailyReportTrendRow>(
    db,
    `
    SELECT
      m.date,
      m.steps,
      m.sleep_hours,
      m.weight_kg,
      m.body_fat_pct,
      m.blood_systolic,
      m.blood_diastolic,
      m.active_kcal,
      m.total_kcal,
      m.intake_kcal,
      nutrition.protein_g,
      nutrition.fat_g,
      nutrition.carbs_g,
      m.bmr_kcal
    FROM daily_metrics AS m
    LEFT JOIN (
      SELECT
        local_date AS date,
        SUM(COALESCE(protein_g, 0) * COALESCE(count, 1)) AS protein_g,
        SUM(COALESCE(fat_g, 0) * COALESCE(count, 1)) AS fat_g,
        SUM(COALESCE(carbs_g, 0) * COALESCE(count, 1)) AS carbs_g
      FROM nutrition_events
      WHERE local_date BETWEEN ? AND ?
      GROUP BY local_date
    ) AS nutrition
      ON nutrition.date = m.date
    WHERE m.date BETWEEN ? AND ?
    ORDER BY m.date ASC
    `,
    [startDate, endDate, startDate, endDate],
  )
}

function averageNumbers(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function roundToOneDecimal(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value * 10) / 10
}

function formatAverageWithCount(values: Array<number | null | undefined>, digits: number): string {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return '-'
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length
  const formatted = digits === 0 ? formatPromptInteger(mean) : formatPromptNumber(mean, digits)
  return `${formatted}(${valid.length}d)`
}

function computeMonthQuarterAverage(
  rows: DailyReportTrendRow[],
  dates: string[],
): MonthlyPromptAverageRow {
  const rowMap = new Map(rows.map((row) => [row.date, row]))
  const targetRows = dates.map((date) => rowMap.get(date)).filter((row): row is DailyReportTrendRow => row != null)
  return {
    steps: formatAverageWithCount(targetRows.map((row) => row.steps), 0),
    sleep_h: formatAverageWithCount(targetRows.map((row) => row.sleep_hours), 1),
    weight: formatAverageWithCount(targetRows.map((row) => row.weight_kg), 1),
    fat_pct: formatAverageWithCount(targetRows.map((row) => row.body_fat_pct), 1),
    active_burn_kcal: formatAverageWithCount(targetRows.map((row) => row.active_kcal), 0),
    total_burn_kcal: formatAverageWithCount(targetRows.map((row) => row.total_kcal), 0),
    intake_kcal: formatAverageWithCount(targetRows.map((row) => row.intake_kcal), 0),
    protein_g: formatAverageWithCount(targetRows.map((row) => row.protein_g), 1),
    fat_g: formatAverageWithCount(targetRows.map((row) => row.fat_g), 1),
    carbs_g: formatAverageWithCount(targetRows.map((row) => row.carbs_g), 1),
  }
}

function extractScoreNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

function extractDomainScore(rawScore: Record<string, unknown>, domainKey: string): number | null {
  const domains = rawScore.domains
  if (!domains || typeof domains !== 'object' || Array.isArray(domains)) {
    return null
  }
  const domain = (domains as Record<string, unknown>)[domainKey]
  if (!domain || typeof domain !== 'object' || Array.isArray(domain)) {
    return null
  }
  return extractScoreNumber((domain as Record<string, unknown>).score)
}

function toMonthlyScoreSummary(rawScore: Record<string, unknown>, hideNutrition: boolean): MonthlyScoreSummary {
  const sleep = extractDomainScore(rawScore, 'sleep')
  const activity = extractDomainScore(rawScore, 'activity')
  const nutrition = hideNutrition ? null : extractDomainScore(rawScore, 'nutrition')
  const condition = extractDomainScore(rawScore, 'condition')
  const overallRaw = (() => {
    const overall = rawScore.overall
    if (!overall || typeof overall !== 'object' || Array.isArray(overall)) {
      return null
    }
    return extractScoreNumber((overall as Record<string, unknown>).score)
  })()

  const overallFromDomains = hideNutrition
    ? averageNumbers([sleep, activity, condition])
    : averageNumbers([sleep, activity, nutrition, condition])

  const overall = roundToOneDecimal(overallRaw ?? overallFromDomains)

  return {
    overall,
    sleep: roundToOneDecimal(sleep),
    activity: roundToOneDecimal(activity),
    nutrition: roundToOneDecimal(nutrition),
    condition: roundToOneDecimal(condition),
  }
}

function computeQuarterScoreAverage(scoreRows: MonthlyScoreDailyRow[], dates: string[]): MonthlyScoreSummary {
  const rowMap = new Map(scoreRows.map((row) => [row.date, row]))
  const periodRows = dates.map((date) => rowMap.get(date)).filter((row): row is MonthlyScoreDailyRow => row != null)
  return {
    overall: roundToOneDecimal(averageNumbers(periodRows.map((row) => row.score.overall))),
    sleep: roundToOneDecimal(averageNumbers(periodRows.map((row) => row.score.sleep))),
    activity: roundToOneDecimal(averageNumbers(periodRows.map((row) => row.score.activity))),
    nutrition: roundToOneDecimal(averageNumbers(periodRows.map((row) => row.score.nutrition))),
    condition: roundToOneDecimal(averageNumbers(periodRows.map((row) => row.score.condition))),
  }
}

function formatScoreRowsForPrompt(scoreRows: MonthlyScorePromptRow[]): string {
  return JSON.stringify(scoreRows)
}

export function buildMonthlyUserPrompt(options: BuildMonthlyUserPromptOptions): string {
  const monthLabel = (() => {
    const [year, month] = options.month.split('-').map(Number)
    return `${year}年${month}月`
  })()

  const hasAnyIntake = [
    options.thisMonthAverage,
    options.prevMonthAverage,
    ...options.quarterAverages.map((item) => item.average),
  ].some((row) => row.intake_kcal !== '-')

  const includeNutritionScore = options.scoreRows.some((row) => 'nutrition' in row.score && row.score.nutrition != null)
  const filteredScoreRows = includeNutritionScore
    ? options.scoreRows
    : options.scoreRows.map((row) => ({
        period: row.period,
        score: {
          overall: row.score.overall,
          sleep: row.score.sleep,
          activity: row.score.activity,
          condition: row.score.condition,
        },
      }))

  const monthAverageSection = [
    '# 月平均の比較（レポートではこの平均値を使って語ること）',
    '| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal |' + (hasAnyIntake ? ' intake_kcal | protein | fat | carbs |' : ''),
    `| 今月 | ${options.thisMonthAverage.steps} | ${options.thisMonthAverage.sleep_h} | ${options.thisMonthAverage.weight} | ${options.thisMonthAverage.fat_pct} | ${options.thisMonthAverage.active_burn_kcal} | ${options.thisMonthAverage.total_burn_kcal}` + (hasAnyIntake ? ` | ${options.thisMonthAverage.intake_kcal} | ${options.thisMonthAverage.protein_g} | ${options.thisMonthAverage.fat_g} | ${options.thisMonthAverage.carbs_g} |` : ' |'),
    `| 前月 | ${options.prevMonthAverage.steps} | ${options.prevMonthAverage.sleep_h} | ${options.prevMonthAverage.weight} | ${options.prevMonthAverage.fat_pct} | ${options.prevMonthAverage.active_burn_kcal} | ${options.prevMonthAverage.total_burn_kcal}` + (hasAnyIntake ? ` | ${options.prevMonthAverage.intake_kcal} | ${options.prevMonthAverage.protein_g} | ${options.prevMonthAverage.fat_g} | ${options.prevMonthAverage.carbs_g} |` : ' |'),
  ]

  const quarterSection = [
    '# 月内の推移（4区間平均）',
    '| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal |' + (hasAnyIntake ? ' intake_kcal | protein | fat | carbs |' : ''),
    ...options.quarterAverages.map(({ period, average }) =>
      `| ${period} | ${average.steps} | ${average.sleep_h} | ${average.weight} | ${average.fat_pct} | ${average.active_burn_kcal} | ${average.total_burn_kcal}` +
      (hasAnyIntake ? ` | ${average.intake_kcal} | ${average.protein_g} | ${average.fat_g} | ${average.carbs_g} |` : ' |')),
  ]

  return [
    `# 月次レポート: ${monthLabel}`,
    '',
    ...monthAverageSection,
    '',
    ...quarterSection,
    '',
    '# 月内のスコア推移（4区間平均）',
    formatScoreRowsForPrompt(filteredScoreRows),
  ].join('\n')
}

export async function generateMonthlyReport(
  env: Env,
  month: string,
  options: MonthlyReportGenerationOptions = {},
): Promise<MonthlyReportGenerationResult> {
  if (!isValidMonth(month)) {
    throw new Error('month must be YYYY-MM')
  }

  const force = options.force ?? false
  const cached = await getMonthlyReport(env.DB, month)
  if (cached && !force) {
    return {
      month,
      generated: false,
      cached: true,
      generated_at: cached.generated_at,
    }
  }

  await ensureAggregatesUpToDate(env.DB)

  const currentMonthStart = monthStartDate(month)
  const currentMonthEnd = monthEndDate(month)
  const previousMonth = shiftYearMonth(month, -1)
  const previousMonthStart = monthStartDate(previousMonth)
  const previousMonthEnd = monthEndDate(previousMonth)

  const trendRows = await queryMonthlyTrendRows(env.DB, previousMonthStart, currentMonthEnd)
  const currentMonthDates = buildDateRange(currentMonthStart, currentMonthEnd)
  const previousMonthDates = buildDateRange(previousMonthStart, previousMonthEnd)
  const monthQuarterRanges = buildMonthQuarterRanges(month)

  const sourceRowMap = new Map(trendRows.map((row) => [row.date, row]))
  const currentMonthDataDays = currentMonthDates.filter((date) => hasAnyDayData(sourceRowMap.get(date))).length
  if (currentMonthDataDays < 7) {
    return {
      month,
      generated: false,
      cached: false,
      reason: 'insufficient_data',
    }
  }

  const maskedTrendRows = maskIncompleteIntake(trendRows)
  const maskedRowMap = new Map(maskedTrendRows.map((row) => [row.date, row]))

  const thisMonthAverage = computeMonthQuarterAverage(maskedTrendRows, currentMonthDates)
  const prevMonthAverage = computeMonthQuarterAverage(maskedTrendRows, previousMonthDates)
  const quarterAverages = monthQuarterRanges.map((range) => ({
    period: range.period,
    average: computeMonthQuarterAverage(maskedTrendRows, range.dates),
  }))

  const dailyScores = await Promise.all(
    currentMonthDates.map(async (date) => {
      const rawScore = await getScores(env.DB, date)
      const hideNutrition = maskedRowMap.get(date)?.intake_kcal == null
      return {
        date,
        score: toMonthlyScoreSummary(rawScore as Record<string, unknown>, hideNutrition),
      }
    }),
  )

  const quarterScoreRows: MonthlyScorePromptRow[] = monthQuarterRanges.map((range) => ({
    period: range.period,
    score: computeQuarterScoreAverage(dailyScores, range.dates),
  }))

  const userPrompt = buildMonthlyUserPrompt({
    month,
    thisMonthAverage,
    prevMonthAverage,
    quarterAverages,
    scoreRows: quarterScoreRows,
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

  if (provider === 'gemini') {
    const limitCheck = await checkMonthlyLimit(env.DB)
    if (!limitCheck.ok) {
      throw new GeminiLimitExceededError(limitCheck.currentCostJpy, limitCheck.limitJpy)
    }
  }

  const generated = await callLlmPlainText(provider, effectiveApiKey, model, MONTHLY_REPORT_SYSTEM_PROMPT, userPrompt, {
    minChars: MONTHLY_REPORT_MIN_CHARS,
    maxChars: MONTHLY_REPORT_MAX_CHARS,
    forbidToday: false,
  })

  if (provider === 'gemini') {
    try {
      await recordGeminiUsage(env.DB, generated.prompt_tokens ?? 0, generated.completion_tokens ?? 0)
    } catch {
      // Usage tracking failure should not block report delivery.
    }
  }

  const generatedAt = nowIso()
  await execute(
    env.DB,
    `
    INSERT INTO monthly_reports(
      month, headline, report, model,
      prompt_tokens, completion_tokens, generated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET
      headline = excluded.headline,
      report = excluded.report,
      model = excluded.model,
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      generated_at = excluded.generated_at
    `,
    [
      month,
      buildMonthlyReportHeadline(generated.text),
      generated.text,
      generated.model,
      generated.prompt_tokens,
      generated.completion_tokens,
      generatedAt,
    ],
  )

  return {
    month,
    generated: true,
    cached: false,
    generated_at: generatedAt,
  }
}

export async function handleMonthlyReportGet(url: URL, env: Env): Promise<Response> {
  const month = url.searchParams.get('month') ?? getLastCompletedMonth()
  if (!isValidMonth(month)) {
    return jsonResponse({ detail: 'month query must be YYYY-MM' }, 400)
  }
  const row = await getMonthlyReport(env.DB, month)
  if (!row) {
    return jsonResponse({ detail: 'Monthly report not found' }, 404)
  }
  return jsonResponse(toMonthlyReportResponse(row))
}

export async function handleMonthlyReportsListGet(url: URL, env: Env): Promise<Response> {
  const limit = parseLimit(url.searchParams.get('limit'), 10)
  const offset = parseOffset(url.searchParams.get('offset'))
  const rows = await queryAll<MonthlyReportRow>(
    env.DB,
    `
    SELECT
      month, headline, report, model,
      prompt_tokens, completion_tokens, generated_at, created_at
    FROM monthly_reports
    ORDER BY month DESC
    LIMIT ? OFFSET ?
    `,
    [limit, offset],
  )
  return jsonResponse({
    reports: rows.map(toMonthlyReportResponse),
  })
}

export async function handleMonthlyReportGenerate(
  request: Request,
  url: URL,
  env: Env,
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

  const bodyMonth = body.month
  if (bodyMonth != null && typeof bodyMonth !== 'string') {
    return jsonResponse({ detail: 'month must be YYYY-MM' }, 400)
  }
  const month = (bodyMonth as string | null) ?? url.searchParams.get('month') ?? getLastCompletedMonth()
  if (!isValidMonth(month)) {
    return jsonResponse({ detail: 'month must be YYYY-MM' }, 400)
  }

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

  try {
    const result = await generateMonthlyReport(env, month, {
      force,
      provider: effectiveProvider,
      apiKey: effectiveApiKey,
      model: overrideModel,
    })
    return jsonResponse({ ...result })
  } catch (error) {
    if (error instanceof GeminiLimitExceededError) {
      return jsonResponse({
        detail: error.message,
        current_cost_jpy: error.currentCostJpy,
        limit_jpy: error.limitJpy,
      }, 429)
    }
    const message = error instanceof Error ? error.message : 'Failed to generate monthly report'
    return jsonResponse({ detail: message }, 500)
  }
}
