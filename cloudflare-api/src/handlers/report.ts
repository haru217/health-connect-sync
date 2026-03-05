import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, LLM_TIMEOUT_MS, REPORT_EMOJI_RE } from '../constants'
import type {
  AnthropicMessageResponse,
  D1Database,
  DailyReportRow,
  Env,
  GeminiResponse,
  OpenAICompatibleResponse,
  UserProfileRow,
} from '../types'
import {
  execute,
  isValidDate,
  jsonResponse,
  nowIso,
  parseBooleanFlag,
  queryAll,
  queryFirst,
  shiftIsoDateByDays,
  toIsoDate,
} from '../utils'
import { checkMonthlyLimit, recordGeminiUsage } from './gemini-usage'
import { getUserProfile } from './profile'
import { getScores } from './scores'
import { ensureAggregatesUpToDate } from './sync-aggregate'

export interface DailyReportTrendRow {
  date: string
  steps: number | null
  sleep_hours: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  blood_systolic: number | null
  blood_diastolic: number | null
  active_kcal: number | null
  total_kcal: number | null
  intake_kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  bmr_kcal: number | null
}

export interface DailyNutritionEventRow {
  consumed_at: string | null
  label: string
  count: number | null
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  note: string | null
  meal_type: string | null
}

export interface HaruPromptContext {
  profile: UserProfileRow
  scores: Record<string, unknown>
  trendRows: DailyReportTrendRow[]
  nutritionEvents: DailyNutritionEventRow[]
}

interface DailyReportGenerationResult {
  text: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
}

interface DailyReportGenerationOptions {
  force?: boolean
  provider?: string
  apiKey?: string
  model?: string
}

interface DailyReportPersistInput {
  date: string
  headline: string
  briefing: string
  yu_comment: string
  saki_comment: string
  mai_comment: string
  condition_comment: string
  activity_comment: string
  meal_comment: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generated_at: string
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

interface PlainTextConstraints {
  minChars: number
  maxChars: number
  forbidToday: boolean
}

interface HaruSystemPromptOptions {
  minChars: number
  maxChars: number
  templatePrompt?: string
}

interface HaruUserPromptOptions {
  date: string
  trendRows: DailyReportTrendRow[]
  nutritionEvents: DailyNutritionEventRow[]
  templatePrompt?: string
  scores?: Record<string, unknown>
}

export async function readOptionalJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10)
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error('Request body too large')
    }
    if (Number.isFinite(parsedLength) && parsedLength <= 0) {
      return {}
    }
  }

  const raw = await request.text()
  if (!raw.trim()) {
    return {}
  }
  if (raw.length > maxBytes) {
    throw new Error('Request body too large')
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Body must be an object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON body'
    throw new Error(`Invalid request body: ${message}`)
  }
}

export function stripReportEmoji(value: string): string {
  return value.replace(REPORT_EMOJI_RE, '')
}

function normalizeGeneratedPlainText(value: string, field: string, constraints: PlainTextConstraints): string {
  const normalized = stripReportEmoji(value)
    // Remove common Markdown syntax as a safety net for plain-text reports.
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) {
    throw new Error(`${field} must not be empty`)
  }
  if (normalized.length < constraints.minChars || normalized.length > constraints.maxChars) {
    throw new Error(`${field} length is out of range`)
  }
  if (constraints.forbidToday && normalized.includes('今日')) {
    throw new Error(`${field} must not include 今日`)
  }
  return normalized
}

function normalizeStoredOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function buildDailyReportHeadline(briefing: string): string {
  const stripped = briefing.replace(/【.+?】/g, '').replace(/\n+/g, ' ').trim()
  const firstSentence = stripped.split('。').map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  if (!firstSentence) {
    return 'ハルのブリーフィング'
  }
  return firstSentence.length <= 30 ? firstSentence : `${firstSentence.slice(0, 30)}…`
}

function formatPromptNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return '-'
  }
  return value.toFixed(digits)
}

function formatPromptInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '-'
  }
  return String(Math.round(value))
}

function formatPromptBloodPressure(systolic: number | null | undefined, diastolic: number | null | undefined): string {
  if (
    systolic == null ||
    diastolic == null ||
    !Number.isFinite(systolic) ||
    !Number.isFinite(diastolic)
  ) {
    return '-'
  }
  return `${Math.round(systolic)}/${Math.round(diastolic)}`
}

function buildDateRange(date: string, days: number): string[] {
  const startDate = shiftIsoDateByDays(date, -(days - 1))
  return Array.from({ length: days }, (_, index) => shiftIsoDateByDays(startDate, index))
}

function buildTrendRowsTable(date: string, trendRows: DailyReportTrendRow[]): string {
  const rowMap = new Map<string, DailyReportTrendRow>(trendRows.map((row) => [row.date, row]))
  const lines = buildDateRange(date, 14).map((day) => {
    const row = rowMap.get(day)
    return `| ${day} | ${formatPromptInteger(row?.steps)} | ${formatPromptNumber(row?.sleep_hours, 1)} | ${formatPromptNumber(row?.weight_kg, 1)} | ${formatPromptNumber(row?.body_fat_pct, 1)} | ${formatPromptBloodPressure(row?.blood_systolic, row?.blood_diastolic)} | ${formatPromptInteger(row?.active_kcal)} | ${formatPromptInteger(row?.total_kcal)} | ${formatPromptInteger(row?.intake_kcal)} | ${formatPromptNumber(row?.protein_g, 1)} | ${formatPromptNumber(row?.fat_g, 1)} | ${formatPromptNumber(row?.carbs_g, 1)} |`
  })
  return lines.join('\n')
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABELS: Record<string, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
}

function formatSingleEvent(event: DailyNutritionEventRow): string {
  const time = event.consumed_at && event.consumed_at.length >= 16
    ? event.consumed_at.slice(11, 16)
    : '--:--'
  const countLabel = event.count == null || !Number.isFinite(event.count) ? '-' : event.count.toFixed(1)
  const noteLabel = event.note?.trim() ? `, note:${event.note.trim()}` : ''
  return `- ${time} ${event.label} x${countLabel}, kcal:${formatPromptNumber(event.kcal, 1)}, P:${formatPromptNumber(event.protein_g, 1)}g, F:${formatPromptNumber(event.fat_g, 1)}g, C:${formatPromptNumber(event.carbs_g, 1)}g${noteLabel}`
}

function formatNutritionEventsForPrompt(events: DailyNutritionEventRow[]): string {
  if (events.length === 0) {
    return '食事記録なし'
  }

  const grouped = new Map<string, DailyNutritionEventRow[]>()
  const noType: DailyNutritionEventRow[] = []

  for (const event of events) {
    const mealType = event.meal_type?.trim().toLowerCase() ?? ''
    if (mealType && MEAL_LABELS[mealType]) {
      const list = grouped.get(mealType) ?? []
      list.push(event)
      grouped.set(mealType, list)
    } else {
      noType.push(event)
    }
  }

  const lines: string[] = []
  for (const mealType of MEAL_TYPES) {
    const items = grouped.get(mealType)
    if (items && items.length > 0) {
      lines.push(`## ${MEAL_LABELS[mealType]}`)
      for (const event of items) {
        lines.push(formatSingleEvent(event))
      }
    }
  }

  if (noType.length > 0) {
    lines.push('## その他')
    for (const event of noType) {
      lines.push(formatSingleEvent(event))
    }
  }

  return lines.join('\n')
}

function formatScoreSummaryForPrompt(scores: Record<string, unknown> | undefined): string {
  if (!scores) {
    return '-'
  }
  const root = scores as Record<string, unknown>
  const overall = root.overall
  const domains = root.domains
  const summary = {
    overall,
    domains,
  }
  return JSON.stringify(summary)
}

export function buildHaruSystemPrompt(options: HaruSystemPromptOptions): string {
  const focusBlock = options.templatePrompt
    ? [
        '',
        '# 今回の分析フォーカス',
        `- ${options.templatePrompt}`,
        '- このテーマを中心に分析してください。',
      ].join('\n')
    : ''

  return [
    'あなたは「ハル」。予防医学に精通した健康アドバイザー。ユーザーの健康データを毎日分析するパートナー。',
    '',
    '# 核心ルール',
    '- 1つの深いインサイト > 3つの浅い観察。必ずドメイン横断の因果関係を語る（睡眠→血圧、活動→体重、食事→体組成など）',
    '- 全ての文に具体的な数値を含め、14日平均や先週との比較で語る',
    '- 存在するデータだけを分析する。記録がない項目には一切触れない（「記録なし」「未入力」等の言及禁止）',
    '- です/ます調。抽象的な励まし禁止。「だからなに？」に答えられない文は書かない',
    '- 推測禁止（歩数が多い理由をでっちあげない等）',
    '- 自明な因果は書かない（「歩数が減ると消費カロリーが減る」は当たり前）',
    '- データの読み上げではなく、ユーザーが気づいていない相関や変化を指摘する',
    '',
    '# 時制',
    '- 朝読むレポート。「昨日」=データ対象日。提案のみ「今日」OK',
    '',
    '# 医療',
    '- データ分析はOK。診断・処方はNG。深刻な異常値→「医療機関への相談を」で止める',
    focusBlock,
    '',
    '# 出力',
    '- プレーンテキストのみ（マークダウン記法禁止）',
    '- 3セクション構成:',
    '【注目ポイント】最も重要なドメイン横断の発見1つ',
    '【データ分析】根拠の数値比較（14日平均比、トレンド）',
    '【今日の提案】具体的・時間指定のアクション1つ',
    '- 各セクション間は空行で区切る',
    `- ${options.minChars}-${options.maxChars}文字`,
  ].join('\n')
}

const DEFAULT_BMR_KCAL = 1500
const INTAKE_COMPLETENESS_RATIO = 0.7

function maskIncompleteIntake(trendRows: DailyReportTrendRow[]): DailyReportTrendRow[] {
  const fallbackBmr = trendRows
    .filter((r) => r.bmr_kcal != null && Number.isFinite(r.bmr_kcal))
    .map((r) => r.bmr_kcal as number)
    .pop() ?? DEFAULT_BMR_KCAL
  const threshold = (bmr: number | null): number =>
    (bmr != null && Number.isFinite(bmr) ? bmr : fallbackBmr) * INTAKE_COMPLETENESS_RATIO

  return trendRows.map((row) => {
    const intake = row.intake_kcal
    if (intake == null || intake < threshold(row.bmr_kcal)) {
      return { ...row, intake_kcal: null, protein_g: null, fat_g: null, carbs_g: null }
    }
    return row
  })
}

function isDataDateIntakeComplete(trendRows: DailyReportTrendRow[], dataDate: string): boolean {
  const row = trendRows.find((r) => r.date === dataDate)
  if (!row || row.intake_kcal == null) {
    return false
  }
  const fallbackBmr = trendRows
    .filter((r) => r.bmr_kcal != null && Number.isFinite(r.bmr_kcal))
    .map((r) => r.bmr_kcal as number)
    .pop() ?? DEFAULT_BMR_KCAL
  const bmr = row.bmr_kcal != null && Number.isFinite(row.bmr_kcal) ? row.bmr_kcal : fallbackBmr
  return row.intake_kcal >= bmr * INTAKE_COMPLETENESS_RATIO
}

export function buildHaruUserPrompt(options: HaruUserPromptOptions): string {
  const dataDate = shiftIsoDateByDays(options.date, -1)
  const templateBlock = options.templatePrompt
    ? [
        '',
        '# 依頼テーマ',
        options.templatePrompt,
      ].join('\n')
    : ''

  const maskedTrendRows = maskIncompleteIntake(options.trendRows)
  const showNutritionDetail = isDataDateIntakeComplete(options.trendRows, dataDate)

  return [
    `# レポート日: ${options.date}朝`,
    `# データ対象日: ${dataDate}（「昨日」= この日のことです）`,
    `# 睡眠データは起床日(${options.date})の記録です`,
    '',
    '# 14日間のデータ',
    '| date | steps | sleep_h | weight | fat% | BP | active_kcal | total_kcal | intake_kcal | protein | fat | carbs |',
    buildTrendRowsTable(dataDate, maskedTrendRows),
    '',
    ...(showNutritionDetail
      ? ['# データ対象日の食事記録', formatNutritionEventsForPrompt(options.nutritionEvents)]
      : []),
    '',
    '# データ対象日のスコア参考',
    formatScoreSummaryForPrompt(options.scores),
    templateBlock,
  ].join('\n')
}

export async function queryDailyReportTrendRows(db: D1Database, date: string): Promise<DailyReportTrendRow[]> {
  const startDate = shiftIsoDateByDays(date, -13)
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
    [startDate, date, startDate, date],
  )
}

export async function queryDailyNutritionEvents(db: D1Database, date: string): Promise<DailyNutritionEventRow[]> {
  return queryAll<DailyNutritionEventRow>(
    db,
    `
    SELECT
      consumed_at,
      label,
      count,
      kcal,
      protein_g,
      fat_g,
      carbs_g,
      note,
      meal_type
    FROM nutrition_events
    WHERE local_date = ?
    ORDER BY consumed_at ASC, id ASC
    `,
    [date],
  )
}

export async function loadHaruPromptContext(db: D1Database, date: string): Promise<HaruPromptContext> {
  const dataDate = shiftIsoDateByDays(date, -1)
  const [profile, scores, trendRows, nutritionEvents] = await Promise.all([
    getUserProfile(db),
    getScores(db, dataDate),
    queryDailyReportTrendRows(db, dataDate),
    queryDailyNutritionEvents(db, dataDate),
  ])

  return {
    profile,
    scores,
    trendRows,
    nutritionEvents,
  }
}

async function callAnthropicDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  let responseStatus = 0
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    })
    responseStatus = response.status
    rawResponse = await response.text()
    if (!response.ok) {
      let detail = ''
      try {
        const parsed = JSON.parse(rawResponse) as Record<string, unknown>
        const err = parsed.error as Record<string, unknown> | undefined
        detail = typeof err?.message === 'string' ? `: ${err.message}` : ''
      } catch {
        // ignore parse failure
      }
      throw new Error(`Anthropic API error (${responseStatus})${detail}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsedResponse: AnthropicMessageResponse
  try {
    parsedResponse = JSON.parse(rawResponse) as AnthropicMessageResponse
  } catch {
    throw new Error('Anthropic API returned invalid JSON')
  }

  const textBlocks = (parsedResponse.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text as string)
  const generatedText = textBlocks.join('\n').trim()
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)
  return {
    text: normalizedText,
    model: typeof parsedResponse.model === 'string' ? parsedResponse.model : model,
    prompt_tokens:
      typeof parsedResponse.usage?.input_tokens === 'number' ? parsedResponse.usage.input_tokens : null,
    completion_tokens:
      typeof parsedResponse.usage?.output_tokens === 'number' ? parsedResponse.usage.output_tokens : null,
  }
}

async function callOpenAIDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: /^(gpt-5|o[1-9])/.test(model) ? 16384 : 1600,
        ...(/^(gpt-5|o[1-9])/.test(model) ? {} : { temperature: 0.5 }),
        messages: [
          { role: /^(gpt-5|o[1-9])/.test(model) ? 'developer' : 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: OpenAICompatibleResponse
  try {
    parsed = JSON.parse(rawResponse) as OpenAICompatibleResponse
  } catch {
    throw new Error('OpenAI API returned invalid JSON')
  }
  const generatedText = parsed.choices?.[0]?.message?.content?.trim() ?? ''
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)

  return {
    text: normalizedText,
    model: typeof parsed.model === 'string' ? parsed.model : model,
    prompt_tokens: typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : null,
    completion_tokens: typeof parsed.usage?.completion_tokens === 'number' ? parsed.usage.completion_tokens : null,
  }
}

async function callGeminiDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const geminiModel = model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`

  let rawResponse = ''
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.5,
        },
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: GeminiResponse
  try {
    parsed = JSON.parse(rawResponse) as GeminiResponse
  } catch {
    throw new Error('Gemini API returned invalid JSON')
  }

  const parts = parsed.candidates?.[0]?.content?.parts ?? []
  const outputPart = [...parts].reverse().find((part) => !part.thought)
  const generatedText = (typeof outputPart?.text === 'string' ? outputPart.text : '').trim()
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)
  return {
    text: normalizedText,
    model: parsed.modelVersion ?? geminiModel,
    prompt_tokens: typeof parsed.usageMetadata?.promptTokenCount === 'number' ? parsed.usageMetadata.promptTokenCount : null,
    completion_tokens: typeof parsed.usageMetadata?.candidatesTokenCount === 'number' ? parsed.usageMetadata.candidatesTokenCount : null,
  }
}

export async function callLlmPlainText(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  if (provider === 'openai') {
    return callOpenAIDailyReport(apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt, constraints)
  }
  if (provider === 'gemini' || provider === 'google') {
    return callGeminiDailyReport(apiKey, model || 'gemini-2.5-flash', systemPrompt, userPrompt, constraints)
  }
  return callAnthropicDailyReport(apiKey, model || DEFAULT_LLM_MODEL, systemPrompt, userPrompt, constraints)
}

export async function getDailyReport(db: D1Database, date: string): Promise<DailyReportRow | null> {
  const row = await queryFirst<DailyReportRow>(
    db,
    `
    SELECT
      date, headline, briefing, yu_comment, saki_comment, mai_comment,
      condition_comment, activity_comment, meal_comment,
      model, prompt_tokens, completion_tokens, generated_at, created_at
    FROM daily_reports
    WHERE date = ?
    LIMIT 1
    `,
    [date],
  )
  return row ?? null
}

export function toDailyReportResponse(row: DailyReportRow): Record<string, unknown> {
  return {
    date: row.date,
    generated_at: row.generated_at,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    briefing: normalizeStoredOptionalText(row.briefing),
    home: {
      headline: row.headline,
      yu: normalizeStoredOptionalText(row.yu_comment),
      saki: normalizeStoredOptionalText(row.saki_comment),
      mai: normalizeStoredOptionalText(row.mai_comment),
      haru: normalizeStoredOptionalText(row.briefing),
    },
    tabs: {
      condition: normalizeStoredOptionalText(row.condition_comment),
      activity: normalizeStoredOptionalText(row.activity_comment),
      meal: normalizeStoredOptionalText(row.meal_comment),
    },
    cached: true,
  }
}

export async function saveDailyReport(db: D1Database, payload: DailyReportPersistInput): Promise<void> {
  await execute(
    db,
    `
    INSERT INTO daily_reports(
      date, headline, briefing, yu_comment, saki_comment, mai_comment,
      condition_comment, activity_comment, meal_comment,
      model, prompt_tokens, completion_tokens, generated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      headline = excluded.headline,
      briefing = excluded.briefing,
      yu_comment = excluded.yu_comment,
      saki_comment = excluded.saki_comment,
      mai_comment = excluded.mai_comment,
      condition_comment = excluded.condition_comment,
      activity_comment = excluded.activity_comment,
      meal_comment = excluded.meal_comment,
      model = excluded.model,
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      generated_at = excluded.generated_at
    `,
    [
      payload.date,
      payload.headline,
      payload.briefing,
      payload.yu_comment,
      payload.saki_comment,
      payload.mai_comment,
      payload.condition_comment,
      payload.activity_comment,
      payload.meal_comment,
      payload.model,
      payload.prompt_tokens,
      payload.completion_tokens,
      payload.generated_at,
    ],
  )
}

export async function handleDailyReportGet(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }

  const row = await getDailyReport(env.DB, date)
  if (!row) {
    return jsonResponse({ detail: 'Report not found' }, 404)
  }
  return jsonResponse(toDailyReportResponse(row))
}

export async function generateDailyReportIfNeeded(
  env: Env,
  date: string,
  options: DailyReportGenerationOptions = {},
): Promise<{ date: string; generated: boolean; cached: boolean; generated_at?: string }> {
  const force = options.force ?? false
  const cached = await getDailyReport(env.DB, date)
  if (cached && !force) {
    return {
      date,
      generated: false,
      cached: true,
      generated_at: cached.generated_at,
    }
  }

  await ensureAggregatesUpToDate(env.DB)
  const promptContext = await loadHaruPromptContext(env.DB, date)
  const systemPrompt = buildHaruSystemPrompt({
    minChars: 300,
    maxChars: 800,
  })
  const userPrompt = buildHaruUserPrompt({
    date,
    trendRows: promptContext.trendRows,
    nutritionEvents: promptContext.nutritionEvents,
    scores: promptContext.scores,
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

  const generated = await callLlmPlainText(provider, effectiveApiKey, model, systemPrompt, userPrompt, {
    minChars: 300,
    maxChars: 800,
    forbidToday: false,
  })
  if (provider === 'gemini') {
    try {
      await recordGeminiUsage(env.DB, generated.prompt_tokens ?? 0, generated.completion_tokens ?? 0)
    } catch {
      // Usage tracking failure should not block report delivery.
    }
  }

  const persistPayload: DailyReportPersistInput = {
    date,
    headline: buildDailyReportHeadline(generated.text),
    briefing: generated.text,
    yu_comment: '',
    saki_comment: '',
    mai_comment: '',
    condition_comment: '',
    activity_comment: '',
    meal_comment: '',
    model: generated.model,
    prompt_tokens: generated.prompt_tokens,
    completion_tokens: generated.completion_tokens,
    generated_at: nowIso(),
  }

  await saveDailyReport(env.DB, persistPayload)

  return {
    date,
    generated: true,
    cached: false,
  }
}

export async function handleDailyReportGenerate(request: Request, url: URL, env: Env): Promise<Response> {
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

  const bodyDate = body.date
  if (bodyDate != null && typeof bodyDate !== 'string') {
    return jsonResponse({ detail: 'date must be YYYY-MM-DD' }, 400)
  }
  const date = (bodyDate as string | null) ?? url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date must be YYYY-MM-DD' }, 400)
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
    const result = await generateDailyReportIfNeeded(env, date, {
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
    const message = error instanceof Error ? error.message : 'Failed to generate daily report'
    return jsonResponse({ detail: message }, 500)
  }
}
