import { LLM_TIMEOUT_MS } from '../constants'
import type { D1Database, Env, GeminiResponse, NutritionEventRow, OpenAICompatibleResponse } from '../types'
import { execute, isValidDate, jsonResponse, nowIso, queryAll, queryFirst, readJsonBody, toNumberOrNull } from '../utils'
import { checkMonthlyLimit, recordGeminiUsage } from './gemini-usage'
import { resolveDateAndTime } from './nutrition'

const FOOD_ANALYZE_DB_LIMIT = 8
const FOOD_CONFIRM_MAX_ITEMS = 20
const FOOD_SEARCH_DEFAULT_LIMIT = 10
const FOOD_SEARCH_MAX_LIMIT = 50
const FOOD_SEARCH_MAX_QUERY_LENGTH = 200
const MAX_IMAGE_BASE64_LENGTH = 7_000_000 // ~5MB decoded
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

const MICRO_KEYS = [
  'saturated_fat_g',
  'omega3_mg',
  'omega6_mg',
  'trans_fat_g',
  'sugar_g',
  'fiber_g',
  'vitamin_a_ug',
  'vitamin_d_ug',
  'vitamin_e_mg',
  'vitamin_k_ug',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_b6_mg',
  'vitamin_b12_ug',
  'vitamin_c_mg',
  'niacin_mg',
  'folate_ug',
  'pantothenic_acid_mg',
  'biotin_ug',
  'sodium_mg',
  'potassium_mg',
  'calcium_mg',
  'magnesium_mg',
  'phosphorus_mg',
  'iron_mg',
  'zinc_mg',
  'copper_mg',
  'manganese_mg',
  'selenium_ug',
  'chromium_ug',
  'molybdenum_ug',
  'iodine_ug',
  'cholesterol_mg',
  'purine_mg',
  'caffeine_mg',
  'alcohol_g',
] as const

type MicroKey = (typeof MICRO_KEYS)[number]
type MicrosPayload = Record<MicroKey, number | null>

interface FoodDbRow {
  id: number
  name: string
  brand: string | null
  amount: string
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  micros_json: string | null
  source: string
  verified: number
  use_count: number
  last_used_at: string | null
}

interface FoodItemNormalized {
  name: string
  brand: string | null
  amount: string
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  micros: MicrosPayload
}

interface ConfirmFoodItem extends FoodItemNormalized {
  save_to_favorites: boolean
  meal_type: string | null
}

class FoodValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FoodValidationError'
  }
}

function readRequiredString(value: unknown, field: string, maxLength = 120): string {
  if (typeof value !== 'string') {
    throw new FoodValidationError(`${field} must be a string`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new FoodValidationError(`${field} must not be empty`)
  }
  if (trimmed.length > maxLength) {
    throw new FoodValidationError(`${field} is too long`)
  }
  return trimmed
}

function readOptionalString(value: unknown, field: string, maxLength = 120): string | null {
  if (value == null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new FoodValidationError(`${field} must be a string or null`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > maxLength) {
    throw new FoodValidationError(`${field} is too long`)
  }
  return trimmed
}

function readRequiredNumber(value: unknown, field: string): number {
  const parsed = toNumberOrNull(value)
  if (parsed == null) {
    throw new FoodValidationError(`${field} must be a number`)
  }
  return parsed
}

function normalizeMicros(value: unknown, field = 'micros'): MicrosPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FoodValidationError(`${field} must be an object`)
  }

  const source = value as Record<string, unknown>
  const normalized: Partial<MicrosPayload> = {}
  for (const key of MICRO_KEYS) {
    const raw = source[key]
    if (raw == null) {
      normalized[key] = null
      continue
    }
    const parsed = toNumberOrNull(raw)
    if (parsed == null) {
      throw new FoodValidationError(`${field}.${key} must be a number or null`)
    }
    normalized[key] = parsed
  }
  return normalized as MicrosPayload
}

function normalizeMicrosFromJson(raw: string | null): MicrosPayload {
  let source: Record<string, unknown> = {}
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        source = parsed as Record<string, unknown>
      }
    } catch {
      source = {}
    }
  }

  const normalized: Partial<MicrosPayload> = {}
  for (const key of MICRO_KEYS) {
    const parsed = toNumberOrNull(source[key])
    normalized[key] = parsed == null ? null : parsed
  }
  return normalized as MicrosPayload
}

function normalizeFoodItem(input: unknown): FoodItemNormalized {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new FoodValidationError('item must be an object')
  }
  const row = input as Record<string, unknown>
  const microsRaw = row.micros
  const micros = microsRaw && typeof microsRaw === 'object' && !Array.isArray(microsRaw)
    ? normalizeMicros(microsRaw, 'items[].micros')
    : Object.fromEntries(MICRO_KEYS.map((k) => [k, null])) as MicrosPayload
  return {
    name: readRequiredString(row.name, 'items[].name'),
    brand: readOptionalString(row.brand, 'items[].brand'),
    amount: readRequiredString(row.amount, 'items[].amount', 64),
    kcal: toNumberOrNull(row.kcal) ?? toNumberOrNull(row.calories) ?? 0,
    protein_g: toNumberOrNull(row.protein_g) ?? toNumberOrNull(row.protein) ?? 0,
    fat_g: toNumberOrNull(row.fat_g) ?? toNumberOrNull(row.fat) ?? 0,
    carbs_g: toNumberOrNull(row.carbs_g) ?? toNumberOrNull(row.carbs) ?? 0,
    micros,
  }
}

function normalizeConfirmFoodItem(input: unknown): ConfirmFoodItem {
  const normalized = normalizeFoodItem(input)
  const item = input as Record<string, unknown>
  const save_to_favorites = item.save_to_favorites === true
  const mealTypeRaw = typeof item.meal_type === 'string' ? item.meal_type.trim() : null
  const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
  const meal_type = mealTypeRaw && VALID_MEAL_TYPES.includes(mealTypeRaw) ? mealTypeRaw : null
  return { ...normalized, save_to_favorites, meal_type }
}

function extractJsonObjectCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    return fenced[1].trim()
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || start >= end) {
    throw new Error('Gemini response did not include a JSON object')
  }
  return raw.slice(start, end + 1).trim()
}

function parseGeminiFoodItems(raw: string): FoodItemNormalized[] {
  const candidate = extractJsonObjectCandidate(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error('Gemini response is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini response JSON must be an object')
  }
  const root = parsed as Record<string, unknown>
  if (!Array.isArray(root.items)) {
    throw new Error('Gemini response must include items array')
  }
  if (root.items.length === 0) {
    throw new Error('Gemini returned empty items array')
  }
  return root.items.map((item) => normalizeFoodItem(item))
}

function clampLimit(value: string | null, fallback: number, max: number): number {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.min(parsed, max)
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function toFoodResponseItem(item: FoodItemNormalized): Record<string, unknown> {
  return {
    name: item.name,
    brand: item.brand,
    amount: item.amount,
    kcal: item.kcal,
    protein_g: item.protein_g,
    fat_g: item.fat_g,
    carbs_g: item.carbs_g,
    micros: { ...item.micros },
  }
}

function toFoodResponseFromDb(row: FoodDbRow): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    amount: row.amount,
    kcal: row.kcal,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
    micros: normalizeMicrosFromJson(row.micros_json),
    source: row.source,
    verified: row.verified,
    use_count: row.use_count,
    last_used_at: row.last_used_at,
  }
}

function toFoodAnalyzeItemFromDb(row: FoodDbRow): Record<string, unknown> {
  return {
    name: row.name,
    brand: row.brand,
    amount: row.amount,
    kcal: row.kcal,
    protein_g: row.protein_g,
    fat_g: row.fat_g,
    carbs_g: row.carbs_g,
    micros: normalizeMicrosFromJson(row.micros_json),
  }
}

async function queryFoodItemsLike(db: D1Database, text: string, limit: number): Promise<FoodDbRow[]> {
  const tokens = text.trim().split(/\s+/).filter((token) => token.length > 0)
  if (tokens.length === 0) {
    return []
  }

  const conditions: string[] = []
  const params: unknown[] = []
  for (const token of tokens) {
    const like = `%${escapeLike(token)}%`
    conditions.push(`(name LIKE ? ESCAPE '\\' OR COALESCE(brand, '') LIKE ? ESCAPE '\\')`)
    params.push(like, like)
  }

  return queryAll<FoodDbRow>(
    db,
    `
    SELECT
      id, name, brand, amount, kcal, protein_g, fat_g, carbs_g, micros_json,
      source, verified, use_count, last_used_at
    FROM food_items
    WHERE ${conditions.join(' AND ')}
    ORDER BY use_count DESC, last_used_at DESC, id DESC
    LIMIT ?
    `,
    [...params, limit],
  )
}

interface ParsedInlineImage {
  mimeType: string
  base64Data: string
}

interface GeminiFoodAnalyzeResult {
  items: FoodItemNormalized[]
  promptTokens: number
  completionTokens: number
}

function parseInlineImage(imageBase64: unknown): ParsedInlineImage | null {
  if (typeof imageBase64 !== 'string') {
    return null
  }
  const trimmed = imageBase64.trim()
  if (!trimmed) {
    return null
  }

  const dataUrl = trimmed.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrl?.[1] && dataUrl[2]) {
    return {
      mimeType: dataUrl[1],
      base64Data: dataUrl[2].replace(/\s+/g, ''),
    }
  }

  return {
    mimeType: 'image/jpeg',
    base64Data: trimmed.replace(/\s+/g, ''),
  }
}

function buildAnalyzePrompt(userText: string | null): string {
  const schemaLines = MICRO_KEYS.map((key) => `        "${key}": number | null`).join('\n')
  const inputLine = userText && userText.trim() ? userText.trim() : '(text not provided, infer from image only)'
  return [
    'Analyze the meal and return nutrition estimates as JSON.',
    'IMPORTANT: All "name", "brand", and "amount" fields MUST be in Japanese (日本語).',
    'For chain restaurants, prioritize official nutrition data when available.',
    'For general foods, use standard Japanese food composition references (文科省食品成分表).',
    '',
    'IMPORTANT: ALWAYS estimate micronutrients based on the ingredients and cooking method.',
    'Use Japanese food composition tables as reference for estimation.',
    'Do NOT return null for common nutrients like sodium, potassium, calcium, iron, zinc, fiber, or B vitamins - these can always be estimated from ingredients.',
    'Only return null for nutrients that truly cannot be estimated from the given information.',
    '',
    `Input text: "${inputLine}"`,
    '',
    'Output schema (strict JSON object only):',
    '{',
    '  "items": [',
    '    {',
    '      "name": "Food name",',
    '      "brand": "Brand name or null",',
    '      "amount": "Serving amount (e.g., 1 bowl, 200g)",',
    '      "kcal": number,',
    '      "protein_g": number,',
    '      "fat_g": number,',
    '      "carbs_g": number,',
    '      "micros": {',
    schemaLines,
    '      }',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}

function buildWebSearchPrompt(userText: string): string {
  const schemaLines = MICRO_KEYS.map((key) => `        "${key}": number | null`).join('\n')
  return [
    `Search the web for the official nutrition data of "${userText}" and return it as JSON.`,
    'IMPORTANT: All "name", "brand", and "amount" fields MUST be in Japanese (日本語).',
    'Prioritize the official restaurant website or reliable nutrition databases.',
    'Use the exact official values - do not estimate or round.',
    '',
    'IMPORTANT: For micronutrients not available from official sources,',
    'estimate based on Japanese food composition tables (文科省食品成分表) and the known ingredients.',
    'Do NOT return null for common nutrients like sodium, potassium, calcium, iron, zinc, fiber, or B vitamins.',
    '',
    'Return ONLY a JSON object (no markdown, no explanation):',
    '{',
    '  "items": [',
    '    {',
    '      "name": "Food name",',
    '      "brand": "Brand name or null",',
    '      "amount": "Serving amount (e.g., 1 bowl, 200g)",',
    '      "kcal": number,',
    '      "protein_g": number,',
    '      "fat_g": number,',
    '      "carbs_g": number,',
    '      "micros": {',
    schemaLines,
    '      }',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}

async function callGeminiFoodAnalyze(
  apiKey: string,
  model: string,
  prompt: string,
  image: ParsedInlineImage | null,
): Promise<GeminiFoodAnalyzeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (image) {
    parts.push({
      inline_data: {
        mime_type: image.mimeType,
        data: image.base64Data,
      },
    })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  let rawResponse = ''
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    })

    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${rawResponse.slice(0, 240)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Gemini API request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsedResponse: GeminiResponse
  try {
    parsedResponse = JSON.parse(rawResponse) as GeminiResponse
  } catch {
    throw new Error('Gemini API returned invalid JSON')
  }

  const responseParts = parsedResponse.candidates?.[0]?.content?.parts ?? []
  const outputPart = [...responseParts].reverse().find((part) => !part.thought && typeof part.text === 'string')
  const generatedText = outputPart?.text?.trim() ?? ''
  if (!generatedText) {
    throw new Error('Gemini returned empty content')
  }

  return {
    items: parseGeminiFoodItems(generatedText),
    promptTokens: typeof parsedResponse.usageMetadata?.promptTokenCount === 'number'
      ? parsedResponse.usageMetadata.promptTokenCount
      : 0,
    completionTokens: typeof parsedResponse.usageMetadata?.candidatesTokenCount === 'number'
      ? parsedResponse.usageMetadata.candidatesTokenCount
      : 0,
  }
}

async function callOpenAIFoodAnalyze(
  apiKey: string,
  model: string,
  prompt: string,
  image: ParsedInlineImage | null,
): Promise<GeminiFoodAnalyzeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  if (image) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64Data}`,
        detail: 'high',
      },
    })
  }

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
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4096,
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${rawResponse.slice(0, 240)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out')
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
  if (!generatedText) {
    throw new Error('OpenAI returned empty content')
  }

  return {
    items: parseGeminiFoodItems(generatedText),
    promptTokens: typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : 0,
    completionTokens: typeof parsed.usage?.completion_tokens === 'number' ? parsed.usage.completion_tokens : 0,
  }
}

async function callOpenAIFoodAnalyzeWithSearch(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<GeminiFoodAnalyzeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'JP',
            },
          },
        ],
        input: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI Responses API error (${response.status}): ${rawResponse.slice(0, 240)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawResponse) as Record<string, unknown>
  } catch {
    throw new Error('OpenAI Responses API returned invalid JSON')
  }

  const output = Array.isArray(parsed.output) ? parsed.output as Array<Record<string, unknown>> : []
  let generatedText = ''
  for (const item of output) {
    if (item.type !== 'message' || !Array.isArray(item.content)) {
      continue
    }
    for (const contentItem of item.content as Array<Record<string, unknown>>) {
      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        generatedText = contentItem.text.trim()
      }
    }
  }
  if (!generatedText) {
    throw new Error('OpenAI Responses API returned empty content')
  }

  let jsonText = generatedText
  const fenced = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced?.[1]) {
    jsonText = fenced[1]
  } else if (!jsonText.startsWith('{')) {
    const start = jsonText.indexOf('{')
    const end = jsonText.lastIndexOf('}')
    if (start >= 0 && end > start) {
      jsonText = jsonText.slice(start, end + 1)
    }
  }

  const usage = parsed.usage
  const usageRecord = usage && typeof usage === 'object' ? usage as Record<string, unknown> : undefined
  const inputTokens = typeof usageRecord?.input_tokens === 'number' ? usageRecord.input_tokens : 0
  const outputTokens = typeof usageRecord?.output_tokens === 'number' ? usageRecord.output_tokens : 0

  return {
    items: parseGeminiFoodItems(jsonText),
    promptTokens: inputTokens,
    completionTokens: outputTokens,
  }
}

async function upsertFavoriteFoodItem(
  db: D1Database,
  item: FoodItemNormalized,
  source: string = 'gemini',
): Promise<void> {
  // kcalが0以下・未設定の場合はfavoritesに保存しない（ゴミデータ防止）
  if (!item.kcal || item.kcal <= 0) return

  const current = await queryFirst<{ id: number }>(
    db,
    `
    SELECT id
    FROM food_items
    WHERE name = ?
      AND amount = ?
      AND ((brand IS NULL AND ? IS NULL) OR brand = ?)
    LIMIT 1
    `,
    [item.name, item.amount, item.brand, item.brand],
  )

  const now = nowIso()
  if (current?.id != null) {
    await execute(
      db,
      `
      UPDATE food_items
      SET
        kcal = ?,
        protein_g = ?,
        fat_g = ?,
        carbs_g = ?,
        micros_json = ?,
        verified = 1,
        use_count = COALESCE(use_count, 0) + 1,
        last_used_at = ?
      WHERE id = ?
      `,
      [item.kcal, item.protein_g, item.fat_g, item.carbs_g, JSON.stringify(item.micros), now, current.id],
    )
    return
  }

  await execute(
    db,
    `
    INSERT INTO food_items(
      name, brand, amount, kcal, protein_g, fat_g, carbs_g, micros_json,
      source, verified, use_count, last_used_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `,
    [item.name, item.brand, item.amount, item.kcal, item.protein_g, item.fat_g, item.carbs_g, JSON.stringify(item.micros), source, now],
  )
}

async function recalculateDailyIntakeKcal(db: D1Database, localDate: string): Promise<number> {
  const row = await queryFirst<{ intake_kcal: number | null }>(
    db,
    `
    SELECT SUM(COALESCE(kcal, 0) * COALESCE(count, 1)) AS intake_kcal
    FROM nutrition_events
    WHERE local_date = ?
    `,
    [localDate],
  )
  const intakeKcal = row?.intake_kcal ?? 0
  await execute(
    db,
    `
    INSERT INTO daily_metrics(date, intake_kcal, record_count)
    VALUES(?, ?, 0)
    ON CONFLICT(date) DO UPDATE SET
      intake_kcal = excluded.intake_kcal
    `,
    [localDate, intakeKcal],
  )
  return intakeKcal
}

function hasMostlyMissingMicros(micros: MicrosPayload): boolean {
  const missingCount = MICRO_KEYS.filter((key) => micros[key] == null).length
  return missingCount > MICRO_KEYS.length / 2
}

function buildMicrosSupplementText(item: FoodItemNormalized): string {
  const brandPart = item.brand ? `${item.brand} ` : ''
  return `${brandPart}${item.name} ${item.amount}`.trim()
}

function fillMissingMicros(base: MicrosPayload, supplement: MicrosPayload): MicrosPayload {
  const merged: Partial<MicrosPayload> = {}
  for (const key of MICRO_KEYS) {
    merged[key] = base[key] ?? supplement[key] ?? null
  }
  return merged as MicrosPayload
}

async function supplementOpenAISearchMicros(
  apiKey: string,
  model: string,
  result: GeminiFoodAnalyzeResult,
): Promise<GeminiFoodAnalyzeResult> {
  let promptTokens = result.promptTokens
  let completionTokens = result.completionTokens
  const items: FoodItemNormalized[] = []

  for (const item of result.items) {
    if (!hasMostlyMissingMicros(item.micros)) {
      items.push(item)
      continue
    }

    try {
      const supplement = await callOpenAIFoodAnalyze(
        apiKey,
        model,
        buildAnalyzePrompt(buildMicrosSupplementText(item)),
        null,
      )
      promptTokens += supplement.promptTokens
      completionTokens += supplement.completionTokens
      const supplementItem = supplement.items[0]
      items.push(
        supplementItem
          ? {
              ...item,
              micros: fillMissingMicros(item.micros, supplementItem.micros),
            }
          : item,
      )
    } catch {
      items.push(item)
    }
  }

  return {
    items,
    promptTokens,
    completionTokens,
  }
}

export async function handleFoodAnalyze(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await readJsonBody(request, 2_000_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  let text: string | null
  try {
    text = readOptionalString(body.text, 'text', 1000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid text'
    return jsonResponse({ detail: message }, 400)
  }
  const image = parseInlineImage(body.image_base64)
  if (!text && !image) {
    return jsonResponse({ detail: 'text or image_base64 is required' }, 400)
  }
  if (image && image.base64Data.length > MAX_IMAGE_BASE64_LENGTH) {
    return jsonResponse({ detail: 'image_base64 is too large (max ~5MB)' }, 400)
  }

  if (text) {
    const dbItems = await queryFoodItemsLike(env.DB, text, FOOD_ANALYZE_DB_LIMIT)
    if (dbItems.length > 0) {
      return jsonResponse({
        source: 'db',
        items: dbItems.map((row) => toFoodAnalyzeItemFromDb(row)),
      })
    }
  }

  const provider = (env.FOOD_LLM_PROVIDER ?? env.LLM_PROVIDER ?? '').trim().toLowerCase() || 'gemini'
  let result: GeminiFoodAnalyzeResult
  if (provider === 'openai') {
    const apiKey = (env.LLM_API_KEY ?? '').trim()
    if (!apiKey) {
      return jsonResponse({ detail: 'LLM_API_KEY is not configured' }, 503)
    }
    const model = (env.FOOD_LLM_MODEL ?? env.LLM_MODEL ?? '').trim() || 'gpt-5.4-mini'
    try {
      if (text && !image) {
        result = await callOpenAIFoodAnalyzeWithSearch(apiKey, model, buildWebSearchPrompt(text))
        result = await supplementOpenAISearchMicros(apiKey, model, result)
        for (const item of result.items) {
          try {
            await upsertFavoriteFoodItem(env.DB, item, 'web_search')
          } catch {
            // Cache save failure should not block response delivery.
          }
        }
      } else {
        result = await callOpenAIFoodAnalyze(apiKey, model, buildAnalyzePrompt(text), image)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze meal'
      console.error(`food-analyze-error: ${message}`)
      return jsonResponse({ detail: 'Failed to analyze meal' }, 502)
    }
  } else {
    const apiKey = (env.GEMINI_API_KEY ?? '').trim()
    if (!apiKey) {
      return jsonResponse({ detail: 'GEMINI_API_KEY is not configured' }, 503)
    }
    const model = (env.GEMINI_MODEL ?? '').trim() || DEFAULT_GEMINI_MODEL
    const limitCheck = await checkMonthlyLimit(env.DB)
    if (!limitCheck.ok) {
      return jsonResponse({
        detail: 'Gemini API の月額上限に達しました。食品DBからの検索は引き続き利用できます。',
        current_cost_jpy: limitCheck.currentCostJpy,
        limit_jpy: limitCheck.limitJpy,
      }, 429)
    }
    try {
      result = await callGeminiFoodAnalyze(apiKey, model, buildAnalyzePrompt(text), image)
      try {
        await recordGeminiUsage(env.DB, result.promptTokens, result.completionTokens)
      } catch {
        // Usage tracking failure should not block response delivery.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze meal'
      console.error(`food-analyze-error: ${message}`)
      return jsonResponse({ detail: 'Failed to analyze meal' }, 502)
    }
  }

  return jsonResponse({
    source: provider === 'openai' ? 'openai' : 'gemini',
    items: result.items.map((item) => toFoodResponseItem(item)),
  })
}

export async function handleFoodConfirm(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await readJsonBody(request, 512_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  const localDateRaw = typeof body.local_date === 'string' ? body.local_date.trim() : ''
  if (!isValidDate(localDateRaw)) {
    return jsonResponse({ detail: 'local_date must be YYYY-MM-DD' }, 400)
  }
  const resolved = resolveDateAndTime({
    local_date: localDateRaw,
    consumed_at: body.consumed_at,
  })
  const consumedAt = resolved.consumedAt

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse({ detail: 'items must be a non-empty array' }, 400)
  }
  if (body.items.length > FOOD_CONFIRM_MAX_ITEMS) {
    return jsonResponse({ detail: `items must not exceed ${FOOD_CONFIRM_MAX_ITEMS}` }, 400)
  }

  let normalizedItems: ConfirmFoodItem[]
  try {
    normalizedItems = body.items.map((item) => normalizeConfirmFoodItem(item))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid items'
    const status = error instanceof FoodValidationError ? 400 : 500
    return jsonResponse({ detail: message }, status)
  }

  let favoritesSaved = 0
  for (const item of normalizedItems) {
    await execute(
      env.DB,
      `
      INSERT INTO nutrition_events(
        consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note, meal_type
      ) VALUES(?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?)
      `,
      [
        consumedAt,
        localDateRaw,
        item.brand,
        item.name,
        item.amount,
        item.kcal,
        item.protein_g,
        item.fat_g,
        item.carbs_g,
        JSON.stringify(item.micros),
        item.meal_type,
      ],
    )

    if (item.save_to_favorites) {
      await upsertFavoriteFoodItem(env.DB, item)
      favoritesSaved += 1
    }
  }

  const intakeKcal = await recalculateDailyIntakeKcal(env.DB, localDateRaw)
  return jsonResponse({
    ok: true,
    local_date: localDateRaw,
    consumed_at: consumedAt,
    saved_count: normalizedItems.length,
    favorites_saved: favoritesSaved,
    intake_kcal: intakeKcal,
  })
}

export async function handleFoodSearch(url: URL, env: Env): Promise<Response> {
  const query = (url.searchParams.get('q') ?? '').trim()
  if (!query) {
    return jsonResponse({ detail: 'q query is required' }, 400)
  }
  if (query.length > FOOD_SEARCH_MAX_QUERY_LENGTH) {
    return jsonResponse({ detail: 'q query is too long' }, 400)
  }
  const limit = clampLimit(url.searchParams.get('limit'), FOOD_SEARCH_DEFAULT_LIMIT, FOOD_SEARCH_MAX_LIMIT)
  const rows = await queryFoodItemsLike(env.DB, query, limit)
  return jsonResponse({
    q: query,
    items: rows.map((row) => toFoodResponseFromDb(row)),
  })
}

export async function handleFoodHistory(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date')
  if (!date || !isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }

  const rows = await queryAll<NutritionEventRow>(
    env.DB,
    `
    SELECT
      id, consumed_at, local_date, alias, label, count, unit,
      kcal, protein_g, fat_g, carbs_g, micros_json, note, meal_type
    FROM nutrition_events
    WHERE local_date = ?
    ORDER BY consumed_at DESC, id DESC
    `,
    [date],
  )

  return jsonResponse({
    date,
    items: rows.map((row) => ({
      id: row.id,
      consumed_at: row.consumed_at,
      local_date: row.local_date,
      name: row.label,
      brand: row.alias,
      amount: row.unit,
      count: row.count,
      kcal: row.kcal,
      protein_g: row.protein_g,
      fat_g: row.fat_g,
      carbs_g: row.carbs_g,
      micros: normalizeMicrosFromJson(row.micros_json),
      note: row.note,
      meal_type: row.meal_type,
    })),
  })
}

export async function handleFoodDelete(pathname: string, env: Env): Promise<Response> {
  const idStr = pathname.replace('/api/food/', '')
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ detail: 'Invalid food id' }, 400)
  }

  const row = await queryFirst<{ local_date: string }>(
    env.DB,
    'SELECT local_date FROM nutrition_events WHERE id = ?',
    [id],
  )
  if (!row) {
    return jsonResponse({ detail: 'Not found' }, 404)
  }

  await execute(env.DB, 'DELETE FROM nutrition_events WHERE id = ?', [id])
  await recalculateDailyIntakeKcal(env.DB, row.local_date)

  return jsonResponse({ ok: true, deleted_id: id })
}

export async function handleFoodUpdate(pathname: string, request: Request, env: Env): Promise<Response> {
  const idStr = pathname.replace('/api/food/', '')
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ detail: 'Invalid food id' }, 400)
  }

  const existing = await queryFirst<{ local_date: string }>(
    env.DB,
    'SELECT local_date FROM nutrition_events WHERE id = ?',
    [id],
  )
  if (!existing) {
    return jsonResponse({ detail: 'Not found' }, 404)
  }

  let body: Record<string, unknown>
  try {
    body = await readJsonBody(request, 512_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) {
    const name = readRequiredString(body.name, 'name')
    updates.push('label = ?')
    values.push(name)
  }
  if (body.amount !== undefined) {
    const amount = readRequiredString(body.amount, 'amount', 64)
    updates.push('unit = ?')
    values.push(amount)
  }
  if (body.kcal !== undefined) {
    updates.push('kcal = ?')
    values.push(toNumberOrNull(body.kcal))
  }
  if (body.protein_g !== undefined) {
    updates.push('protein_g = ?')
    values.push(toNumberOrNull(body.protein_g))
  }
  if (body.fat_g !== undefined) {
    updates.push('fat_g = ?')
    values.push(toNumberOrNull(body.fat_g))
  }
  if (body.carbs_g !== undefined) {
    updates.push('carbs_g = ?')
    values.push(toNumberOrNull(body.carbs_g))
  }
  if (body.micros_json !== undefined) {
    updates.push('micros_json = ?')
    values.push(typeof body.micros_json === 'string' ? body.micros_json : JSON.stringify(body.micros_json))
  }
  if (body.meal_type !== undefined) {
    const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
    const mt = typeof body.meal_type === 'string' ? body.meal_type.trim() : null
    updates.push('meal_type = ?')
    values.push(mt && VALID_MEAL_TYPES.includes(mt) ? mt : null)
  }

  if (updates.length === 0) {
    return jsonResponse({ detail: 'No fields to update' }, 400)
  }

  values.push(id)
  await execute(
    env.DB,
    `UPDATE nutrition_events SET ${updates.join(', ')} WHERE id = ?`,
    values,
  )

  await recalculateDailyIntakeKcal(env.DB, existing.local_date)

  return jsonResponse({ ok: true, updated_id: id })
}
