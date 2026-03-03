import { CORS_HEADERS, CURSOR_REPAIR_SAFETY_MS, DATE_RE, EXERCISE_FREQ_VALUES, EXERCISE_INTENSITY_VALUES, EXERCISE_TYPE_VALUES, GENDER_VALUES, PROFILE_USER_ID, RECORD_TYPE_META_PREFIX, WEIGHT_GOAL_VALUES } from './constants'
import type { D1Database, Env, MetricPeriod, UserProfileRow } from './types'

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

export function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export function isAuthorized(request: Request, env: Env): boolean {
  const key = (env.API_KEY ?? '').trim()
  if (!key) {
    return true
  }
  const provided = request.headers.get('X-Api-Key') ?? request.headers.get('x-api-key') ?? ''
  return provided.trim() === key
}

export async function readJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10)
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new Error('Request body too large')
    }
  }

  try {
    const raw = await request.text()
    if (raw.length > maxBytes) {
      throw new Error('Request body too large')
    }
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

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function hasOwn(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key)
}

export function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true
    }
    if (value === 0) {
      return false
    }
    return null
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false
    }
  }
  return null
}

export function normalizeLensFlag(value: unknown): 0 | 1 | null {
  if (value == null) {
    return null
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (typeof value === 'number' && Number.isInteger(value) && (value === 0 || value === 1)) {
    return value as 0 | 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true') {
      return 1
    }
    if (normalized === '0' || normalized === 'false') {
      return 0
    }
  }
  return null
}

export function toValidatedInteger(value: unknown, field: string, min: number, max: number): number {
  const n = toNumberOrNull(value)
  if (n == null || !Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`)
  }
  return n
}

export function toValidatedNumber(value: unknown, field: string, min: number, max: number): number {
  const n = toNumberOrNull(value)
  if (n == null || n < min || n > max) {
    throw new ValidationError(`${field} must be a number between ${min} and ${max}`)
  }
  return n
}

export function toValidatedEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`)
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export function emptyUserProfile(): UserProfileRow {
  return {
    user_id: PROFILE_USER_ID,
    age: null,
    gender: null,
    height_cm: null,
    goal_weight_kg: null,
    sleep_goal_minutes: 420,
    steps_goal: 8000,
    weight_goal: null,
    bp_goal_systolic: null,
    bp_goal_diastolic: null,
    lens_weight: 0,
    lens_bp: 0,
    lens_sleep: 0,
    lens_performance: 0,
    exercise_freq: null,
    exercise_type: null,
    exercise_intensity: null,
    created_at: null,
    updated_at: null,
  }
}

export function sanitizeUserProfileRow(row: UserProfileRow | null): UserProfileRow {
  const safeGender =
    row?.gender != null && GENDER_VALUES.includes(row.gender)
      ? row.gender
      : null
  const safeWeightGoal =
    row?.weight_goal != null && WEIGHT_GOAL_VALUES.includes(row.weight_goal)
      ? row.weight_goal
      : null
  const safeExerciseFreq =
    row?.exercise_freq != null && EXERCISE_FREQ_VALUES.includes(row.exercise_freq)
      ? row.exercise_freq
      : null
  const safeExerciseType =
    row?.exercise_type != null && EXERCISE_TYPE_VALUES.includes(row.exercise_type)
      ? row.exercise_type
      : null
  const safeExerciseIntensity =
    row?.exercise_intensity != null && EXERCISE_INTENSITY_VALUES.includes(row.exercise_intensity)
      ? row.exercise_intensity
      : null

  if (!row) {
    return emptyUserProfile()
  }
  return {
    user_id: row.user_id || PROFILE_USER_ID,
    age: row.age,
    gender: safeGender,
    height_cm: row.height_cm,
    goal_weight_kg: row.goal_weight_kg,
    sleep_goal_minutes:
      row.sleep_goal_minutes != null && Number.isInteger(row.sleep_goal_minutes) && row.sleep_goal_minutes > 0
        ? row.sleep_goal_minutes
        : 420,
    steps_goal:
      row.steps_goal != null && Number.isInteger(row.steps_goal) && row.steps_goal > 0
        ? row.steps_goal
        : 8000,
    weight_goal: safeWeightGoal,
    bp_goal_systolic: row.bp_goal_systolic,
    bp_goal_diastolic: row.bp_goal_diastolic,
    lens_weight: row.lens_weight === 1 ? 1 : 0,
    lens_bp: row.lens_bp === 1 ? 1 : 0,
    lens_sleep: row.lens_sleep === 1 ? 1 : 0,
    lens_performance: row.lens_performance === 1 ? 1 : 0,
    exercise_freq: safeExerciseFreq,
    exercise_type: safeExerciseType,
    exercise_intensity: safeExerciseIntensity,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function toPositiveCount(value: unknown, fallback = 1): number {
  const parsed = toNumberOrNull(value)
  if (parsed == null || parsed <= 0) {
    return fallback
  }
  return Math.max(1, Math.round(parsed))
}

export function normalizeStringArray(value: unknown, maxLength = 128): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out = new Set<string>()
  for (const raw of value) {
    if (typeof raw !== 'string') {
      continue
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      continue
    }
    out.add(trimmed)
    if (out.size >= maxLength) {
      break
    }
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

export function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

export function parseMetricPeriod(value: unknown): MetricPeriod | null {
  if (value === 'week' || value === 'month' || value === 'year') {
    return value
  }
  return null
}

export function utcDateFromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function shiftIsoDateByDays(value: string, deltaDays: number): string {
  const base = utcDateFromIsoDate(value)
  base.setUTCDate(base.getUTCDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

export function toYearMonth(value: string): string {
  return value.slice(0, 7)
}

export function shiftYearMonth(value: string, deltaMonths: number): string {
  const parts = value.split('-')
  const year = Number.parseInt(parts[0] ?? '', 10)
  const month = Number.parseInt(parts[1] ?? '', 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return value
  }
  const d = new Date(Date.UTC(year, month - 1 + deltaMonths, 1))
  return d.toISOString().slice(0, 7)
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function clampCursorMillisForRepair(ms: number): number {
  const maxMs = Date.now() - CURSOR_REPAIR_SAFETY_MS
  return ms > maxMs ? maxMs : ms
}

export function isSmokeDeviceId(deviceId: string): boolean {
  return deviceId.toLowerCase().includes('smoke')
}

export function isMetaRecordType(recordType: string): boolean {
  return recordType.startsWith(RECORD_TYPE_META_PREFIX)
}

export function parseMicros(raw: string | null): Record<string, number> {
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const entries = Object.entries(parsed).filter((entry): entry is [string, number] => {
      const [, value] = entry
      return typeof value === 'number' && Number.isFinite(value)
    })
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

export function toNullableSum(value: number): number | null {
  return Number.isFinite(value) && value !== 0 ? value : null
}

export async function queryAll<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T[]> {
  const result = (await db.prepare(sql).bind(...binds).all()) as { results?: T[] }
  return result.results ?? []
}

export async function queryFirst<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T | null> {
  const result = (await db.prepare(sql).bind(...binds).first()) as T | null
  return result ?? null
}

export async function execute(db: D1Database, sql: string, binds: unknown[] = []): Promise<void> {
  await db.prepare(sql).bind(...binds).run()
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // no-op
  }
  return {}
}

export function parseIsoDatePart(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const matched = value.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (!matched) {
    return null
  }
  return matched[1] ?? null
}

export function parseIsoToMillis(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    return null
  }
  return ms
}

export function parseIsoToDate(value: string | null | undefined): Date | null {
  const ms = parseIsoToMillis(value)
  if (ms == null) {
    return null
  }
  return new Date(ms)
}

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function weightedAverage(
  values: Array<number | null | undefined>,
  weights: Array<number | null | undefined>,
): number | null {
  let weightedSum = 0
  let weightTotal = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    const weight = weights[index]
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      continue
    }
    weightedSum += value * weight
    weightTotal += weight
  }

  if (weightTotal <= 0) {
    return null
  }
  return weightedSum / weightTotal
}

export function formatSleepLabel(sleepMinutes: number | null): string | null {
  if (sleepMinutes == null || sleepMinutes <= 0) {
    return null
  }
  const hours = Math.floor(sleepMinutes / 60)
  const minutes = sleepMinutes % 60
  return `${hours}h${String(minutes).padStart(2, '0')}m`
}

