interface Env {
  DB: D1Database
  API_KEY?: string
  MOCK_SEED_TOKEN?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
  LLM_PROVIDER?: string
}

type ReportType = 'daily' | 'weekly' | 'monthly'
type SexType = 'male' | 'female' | 'other'
type WeightGoalType = 'lose' | 'gain' | 'maintain'
type ExerciseFreqType = 'none' | 'weekly12' | 'weekly35' | 'daily'
type ExerciseType = 'walk' | 'gym' | 'run' | 'bodyweight' | 'none'
type ExerciseIntensityType = 'light' | 'moderate' | 'high'

interface DailyMetricRow {
  date: string
  steps: number | null
  distance_km: number | null
  active_kcal: number | null
  total_kcal: number | null
  intake_kcal: number | null
  sleep_hours: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  resting_bpm: number | null
  heart_bpm: number | null
  spo2_pct: number | null
  blood_systolic: number | null
  blood_diastolic: number | null
  bmr_kcal: number | null
  record_count: number
}

interface NutritionEventRow {
  id: number
  consumed_at: string
  local_date: string
  alias: string | null
  label: string
  count: number
  unit: string | null
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  micros_json: string | null
  note: string | null
}

interface ProfileRow {
  id: number
  name: string | null
  height_cm: number | null
  birth_year: number | null
  sex: SexType | null
  goal_weight_kg: number | null
  sleep_goal_minutes?: number | null
  steps_goal?: number | null
  updated_at: string
}

interface UserProfileRow {
  user_id: string
  age: number | null
  gender: SexType | null
  height_cm: number | null
  goal_weight_kg: number | null
  sleep_goal_minutes: number
  steps_goal: number
  weight_goal: WeightGoalType | null
  bp_goal_systolic: number | null
  bp_goal_diastolic: number | null
  lens_weight: number | null
  lens_bp: number | null
  lens_sleep: number | null
  lens_performance: number | null
  exercise_freq: ExerciseFreqType | null
  exercise_type: ExerciseType | null
  exercise_intensity: ExerciseIntensityType | null
  created_at: string | null
  updated_at: string | null
}

interface ReportRow {
  id: number
  report_date: string
  report_type: ReportType
  prompt_used: string
  content: string
  created_at: string
}

interface DailyReportRow {
  date: string
  headline: string
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
  created_at: string
}

interface DailyReportGeneratedPayload {
  headline: string
  yu_comment: string
  saki_comment: string
  mai_comment: string
  condition_comment: string
  activity_comment: string
  meal_comment: string
}

interface AnthropicMessageResponse {
  id?: string
  model?: string
  content?: Array<{ type?: string; text?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

interface OpenAICompatibleResponse {
  model?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  modelVersion?: string
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

interface HealthRecordRow {
  record_key: string
  device_id: string
  type: string
  record_id: string | null
  source: string | null
  start_time: string | null
  end_time: string | null
  time: string | null
  last_modified_time: string | null
  unit: string | null
  payload_json: string
  ingested_at: string
}

interface SyncRecordInput {
  type: string
  recordId?: string
  recordKey?: string
  source?: string
  startTime?: string
  endTime?: string
  time?: string
  lastModifiedTime?: string
  unit?: string
  payload?: unknown
}

interface SyncRequestInput {
  deviceId: string
  syncId: string
  syncedAt: string
  rangeStart: string
  rangeEnd: string
  records: SyncRecordInput[]
  requiredPermissions?: string[]
  grantedPermissions?: string[]
}

interface CatalogItem {
  alias: string
  label: string
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  unit: string
  micros?: Record<string, number>
}

const REPORT_TYPES: readonly ReportType[] = ['daily', 'weekly', 'monthly'] as const
const PROFILE_USER_ID = 'default'
const WEIGHT_GOAL_VALUES: readonly WeightGoalType[] = ['lose', 'gain', 'maintain'] as const
const EXERCISE_FREQ_VALUES: readonly ExerciseFreqType[] = ['none', 'weekly12', 'weekly35', 'daily'] as const
const EXERCISE_TYPE_VALUES: readonly ExerciseType[] = ['walk', 'gym', 'run', 'bodyweight', 'none'] as const
const EXERCISE_INTENSITY_VALUES: readonly ExerciseIntensityType[] = ['light', 'moderate', 'high'] as const
const GENDER_VALUES: readonly SexType[] = ['male', 'female', 'other'] as const
const USER_PROFILE_PATCH_KEYS = new Set([
  'age',
  'gender',
  'height_cm',
  'goal_weight_kg',
  'sleep_goal_minutes',
  'steps_goal',
  'weight_goal',
  'bp_goal_systolic',
  'bp_goal_diastolic',
  'lens_weight',
  'lens_bp',
  'lens_sleep',
  'lens_performance',
  'exercise_freq',
  'exercise_type',
  'exercise_intensity',
])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CURSOR_REPAIR_SAFETY_MS = 5 * 60 * 1000
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000
const DETAILED_RETENTION_DAYS = 14
const MIN_VALID_BMR_KCAL_PER_DAY = 600
const MAX_VALID_BMR_KCAL_PER_DAY = 4500
const PRUNABLE_RECORD_TYPES = [
  'StepsRecord',
  'DistanceRecord',
  'SpeedRecord',
  'ActivityIntensityRecord',
  'ActiveCaloriesBurnedRecord',
  'TotalCaloriesBurnedRecord',
] as const
const HEALTH_CONNECT_REQUIRED_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_SPEED',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_METABOLIC_RATE',
  'android.permission.health.READ_HEIGHT',
  'android.permission.health.READ_BODY_FAT',
] as const
const DEFAULT_BASELINE_SCORE: Readonly<Record<'sleep' | 'activity' | 'nutrition' | 'condition', number>> = {
  sleep: 70,
  activity: 60,
  nutrition: 75,
  condition: 73,
}
const DEFAULT_BMR_KCAL = 1500
const DEFAULT_LLM_PROVIDER = 'anthropic'
const DEFAULT_LLM_MODEL = 'claude-haiku-4-5-20251001'
const LLM_TIMEOUT_MS = 60_000
const REPORT_EMOJI_RE = /\p{Extended_Pictographic}/gu
const RECORD_PERMISSION_MAP: Readonly<Record<string, (typeof HEALTH_CONNECT_REQUIRED_PERMISSIONS)[number]>> = {
  StepsRecord: 'android.permission.health.READ_STEPS',
  WeightRecord: 'android.permission.health.READ_WEIGHT',
  SleepSessionRecord: 'android.permission.health.READ_SLEEP',
  HeartRateRecord: 'android.permission.health.READ_HEART_RATE',
  ExerciseSessionRecord: 'android.permission.health.READ_EXERCISE',
  ActiveCaloriesBurnedRecord: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  DistanceRecord: 'android.permission.health.READ_DISTANCE',
  TotalCaloriesBurnedRecord: 'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  SpeedRecord: 'android.permission.health.READ_SPEED',
  RestingHeartRateRecord: 'android.permission.health.READ_RESTING_HEART_RATE',
  BloodPressureRecord: 'android.permission.health.READ_BLOOD_PRESSURE',
  OxygenSaturationRecord: 'android.permission.health.READ_OXYGEN_SATURATION',
  BodyTemperatureRecord: 'android.permission.health.READ_BODY_TEMPERATURE',
  BasalBodyTemperatureRecord: 'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  BasalMetabolicRateRecord: 'android.permission.health.READ_BASAL_METABOLIC_RATE',
  HeightRecord: 'android.permission.health.READ_HEIGHT',
  BodyFatRecord: 'android.permission.health.READ_BODY_FAT',
}
const RECORD_TYPE_META_PREFIX = '__meta__'
const LAST_AGGREGATED_AT_MS_KEY = `${RECORD_TYPE_META_PREFIX}last_aggregated_at_ms`
const CORS_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type, X-Api-Key, X-Seed-Token',
}

const SUPPLEMENT_CATALOG: Readonly<Record<string, CatalogItem>> = {
  protein: {
    alias: 'protein',
    label: '\u30df\u30eb\u30af\u30d7\u30ed\u30c6\u30a4\u30f3',
    kcal: 107,
    protein_g: 20,
    fat_g: 0,
    carbs_g: 6.8,
    unit: '\u672c',
  },
  vitamin_d: {
    alias: 'vitamin_d',
    label: '\u30d3\u30bf\u30df\u30f3D',
    kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    unit: '\u9320',
    micros: { vitamin_d3_mcg: 50 },
  },
  multivitamin: {
    alias: 'multivitamin',
    label: '\u30de\u30eb\u30c1\u30d3\u30bf\u30df\u30f3',
    kcal: 3.36,
    protein_g: 0.1,
    fat_g: 0.1,
    carbs_g: 0.656,
    unit: '\u9320',
    micros: {
      calcium_mg: 200,
      magnesium_mg: 100,
      zinc_mg: 6,
      vitamin_c_mg: 125,
      vitamin_e_mg: 9,
      folate_mcg: 240,
    },
  },
  fish_oil: {
    alias: 'fish_oil',
    label: '\u30d5\u30a3\u30c3\u30b7\u30e5\u30aa\u30a4\u30eb',
    kcal: 8.34,
    protein_g: 0.222,
    fat_g: 0.791,
    carbs_g: 0.1,
    unit: '\u9320',
    micros: { omega3_mg: 270 },
  },
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

function isAuthorized(request: Request, env: Env): boolean {
  const key = (env.API_KEY ?? '').trim()
  if (!key) {
    return true
  }
  const provided = request.headers.get('X-Api-Key') ?? request.headers.get('x-api-key') ?? ''
  return provided.trim() === key
}

async function readJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
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

class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function hasOwn(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key)
}

function parseBooleanFlag(value: unknown): boolean | null {
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

function normalizeLensFlag(value: unknown): 0 | 1 | null {
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

function toValidatedInteger(value: unknown, field: string, min: number, max: number): number {
  const n = toNumberOrNull(value)
  if (n == null || !Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`)
  }
  return n
}

function toValidatedNumber(value: unknown, field: string, min: number, max: number): number {
  const n = toNumberOrNull(value)
  if (n == null || n < min || n > max) {
    throw new ValidationError(`${field} must be a number between ${min} and ${max}`)
  }
  return n
}

function toValidatedEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`)
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function emptyUserProfile(): UserProfileRow {
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

function sanitizeUserProfileRow(row: UserProfileRow | null): UserProfileRow {
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

function toPositiveCount(value: unknown, fallback = 1): number {
  const parsed = toNumberOrNull(value)
  if (parsed == null || parsed <= 0) {
    return fallback
  }
  return Math.max(1, Math.round(parsed))
}

function normalizeStringArray(value: unknown, maxLength = 128): string[] {
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

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

type MetricPeriod = 'week' | 'month' | 'year'

function parseMetricPeriod(value: unknown): MetricPeriod | null {
  if (value === 'week' || value === 'month' || value === 'year') {
    return value
  }
  return null
}

function utcDateFromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function shiftIsoDateByDays(value: string, deltaDays: number): string {
  const base = utcDateFromIsoDate(value)
  base.setUTCDate(base.getUTCDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

function toYearMonth(value: string): string {
  return value.slice(0, 7)
}

function shiftYearMonth(value: string, deltaMonths: number): string {
  const parts = value.split('-')
  const year = Number.parseInt(parts[0] ?? '', 10)
  const month = Number.parseInt(parts[1] ?? '', 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return value
  }
  const d = new Date(Date.UTC(year, month - 1 + deltaMonths, 1))
  return d.toISOString().slice(0, 7)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nowIso(): string {
  return new Date().toISOString()
}

function clampCursorMillisForRepair(ms: number): number {
  const maxMs = Date.now() - CURSOR_REPAIR_SAFETY_MS
  return ms > maxMs ? maxMs : ms
}

function isSmokeDeviceId(deviceId: string): boolean {
  return deviceId.toLowerCase().includes('smoke')
}

function isMetaRecordType(recordType: string): boolean {
  return recordType.startsWith(RECORD_TYPE_META_PREFIX)
}

function parseMicros(raw: string | null): Record<string, number> {
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

function toNullableSum(value: number): number | null {
  return Number.isFinite(value) && value !== 0 ? value : null
}

async function queryAll<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T[]> {
  const result = await db.prepare(sql).bind(...binds).all<T>()
  return result.results ?? []
}

async function queryFirst<T>(db: D1Database, sql: string, binds: unknown[] = []): Promise<T | null> {
  const row = await db.prepare(sql).bind(...binds).first<T>()
  return row ?? null
}

async function execute(db: D1Database, sql: string, binds: unknown[] = []): Promise<void> {
  await db.prepare(sql).bind(...binds).run()
}

function parseJsonObject(raw: string): Record<string, unknown> {
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

function parseIsoDatePart(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const matched = value.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (!matched) {
    return null
  }
  return matched[1] ?? null
}

function parseIsoToMillis(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    return null
  }
  return ms
}

function parseIsoToDate(value: string | null | undefined): Date | null {
  const ms = parseIsoToMillis(value)
  if (ms == null) {
    return null
  }
  return new Date(ms)
}

function isoDateFromMillis(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function localDayFromIso(value: string | null | undefined): string | null {
  const day = parseIsoDatePart(value)
  if (day) {
    return day
  }
  const ms = parseIsoToMillis(value)
  if (ms == null) {
    return null
  }
  return isoDateFromMillis(ms)
}

function findNumber(value: unknown, keyCandidates: Set<string>, depth = 0): number | null {
  if (depth > 7 || value == null) {
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && (typeof item === 'object' || Array.isArray(item))) {
        const hit = findNumber(item, keyCandidates, depth + 1)
        if (hit != null) {
          return hit
        }
      }
    }
    return null
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const [key, nested] of Object.entries(obj)) {
      if (keyCandidates.has(key)) {
        const direct = toNumberOrNull(nested)
        if (direct != null) {
          return direct
        }
      }
    }
    for (const nested of Object.values(obj)) {
      if (nested && (typeof nested === 'object' || Array.isArray(nested))) {
        const hit = findNumber(nested, keyCandidates, depth + 1)
        if (hit != null) {
          return hit
        }
      }
    }
  }
  return null
}

function toPercent(value: number | null): number | null {
  if (value == null) {
    return null
  }
  if (value >= 0 && value <= 1.2) {
    return value * 100
  }
  return value
}

function parseZoneOffsetSeconds(value: unknown): number | null {
  if (value == null) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const sec = Math.round(value)
    if (sec >= -18 * 3600 && sec <= 18 * 3600) {
      return sec
    }
    return null
  }
  if (typeof value === 'string') {
    const s = value.trim().toUpperCase()
    if (!s) {
      return null
    }
    if (s === 'Z' || s === 'UTC' || s === 'GMT') {
      return 0
    }
    const raw = s.startsWith('UTC') || s.startsWith('GMT') ? s.slice(3).trim() : s
    const match = raw.match(/^([+-])(\d{2})(?::?(\d{2}))?$/)
    if (!match) {
      return null
    }
    const sign = match[1] === '-' ? -1 : 1
    const hours = Number.parseInt(match[2] ?? '0', 10)
    const mins = Number.parseInt(match[3] ?? '0', 10)
    if (hours > 18 || mins > 59) {
      return null
    }
    return sign * (hours * 3600 + mins * 60)
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const candidateKeys = ['totalSeconds', 'seconds', 'id', 'zoneOffset', 'offset', 'value']
    for (const key of candidateKeys) {
      const sec = parseZoneOffsetSeconds(obj[key])
      if (sec != null) {
        return sec
      }
    }
  }
  return null
}

function dayInOffset(isoValue: string | null | undefined, offsetSeconds: number): string | null {
  const ms = parseIsoToMillis(isoValue)
  if (ms == null) {
    return null
  }
  return isoDateFromMillis(ms + offsetSeconds * 1000)
}

function sleepBucketDay(startIso: string | null, endIso: string | null, payload: Record<string, unknown>): string | null {
  const endOffset = parseZoneOffsetSeconds(payload.endZoneOffset)
  if (endOffset != null) {
    return dayInOffset(endIso, endOffset)
  }
  const startOffset = parseZoneOffsetSeconds(payload.startZoneOffset)
  if (startOffset != null) {
    return dayInOffset(endIso, startOffset)
  }
  return localDayFromIso(endIso) ?? localDayFromIso(startIso)
}

function toStageInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return Math.round(parsed)
    }
  }
  return null
}

interface SleepStageInterval {
  stage: number
  start: number
  end: number
}

interface SleepStageBreakdown {
  total_minutes: number
  deep_min: number
  light_min: number
  rem_min: number
}

function mergedIntervalMinutes(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) {
    return 0
  }
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  let [curStart, curEnd] = sorted[0] ?? [0, 0]
  let totalMs = 0
  for (const [start, end] of sorted.slice(1)) {
    if (start <= curEnd) {
      if (end > curEnd) {
        curEnd = end
      }
      continue
    }
    totalMs += Math.max(0, curEnd - curStart)
    curStart = start
    curEnd = end
  }
  totalMs += Math.max(0, curEnd - curStart)
  return totalMs / 60000
}

function parseSleepStageIntervals(payload: Record<string, unknown>): {
  intervals: SleepStageInterval[]
  has_valid_intervals: boolean
} {
  const stagesRaw = payload.stages
  if (!Array.isArray(stagesRaw)) {
    return {
      intervals: [],
      has_valid_intervals: false,
    }
  }

  const intervals: SleepStageInterval[] = []
  let hasValidIntervals = false
  for (const stage of stagesRaw) {
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      continue
    }
    const obj = stage as Record<string, unknown>
    const st = parseIsoToMillis(typeof obj.startTime === 'string' ? obj.startTime : null)
    const et = parseIsoToMillis(typeof obj.endTime === 'string' ? obj.endTime : null)
    if (st == null || et == null || et <= st) {
      continue
    }
    hasValidIntervals = true
    const stageInt = toStageInt(obj.stage)
    if (stageInt == null) {
      continue
    }
    intervals.push({
      stage: stageInt,
      start: st,
      end: et,
    })
  }

  return {
    intervals,
    has_valid_intervals: hasValidIntervals,
  }
}

function extractSleepMinutes(startIso: string | null, endIso: string | null, payload: Record<string, unknown>): number {
  const startMs = parseIsoToMillis(startIso)
  const endMs = parseIsoToMillis(endIso)
  if (startMs == null || endMs == null || endMs <= startMs) {
    return 0
  }

  const stageValueSet = new Set<number>([2, 4, 5, 6])
  const detailedSet = new Set<number>([4, 5, 6])
  const parsedResult = parseSleepStageIntervals(payload)
  if (!parsedResult.has_valid_intervals) {
    return (endMs - startMs) / 60000
  }

  const parsed = parsedResult.intervals.filter((item) => stageValueSet.has(item.stage))

  const hasDetailed = parsed.some((item) => detailedSet.has(item.stage))
  const effective = parsed
    .filter((item) => (hasDetailed ? detailedSet.has(item.stage) : stageValueSet.has(item.stage)))
    .map((item) => [item.start, item.end] as [number, number])
  if (effective.length === 0) {
    return 0
  }
  return mergedIntervalMinutes(effective)
}

function extractSleepStageBreakdown(
  startIso: string | null,
  endIso: string | null,
  payload: Record<string, unknown>,
): SleepStageBreakdown {
  const startMs = parseIsoToMillis(startIso)
  const endMs = parseIsoToMillis(endIso)
  if (startMs == null || endMs == null || endMs <= startMs) {
    return {
      total_minutes: 0,
      deep_min: 0,
      light_min: 0,
      rem_min: 0,
    }
  }

  const parsedResult = parseSleepStageIntervals(payload)
  const roughDurationMin = (endMs - startMs) / 60000
  if (!parsedResult.has_valid_intervals) {
    return {
      total_minutes: roughDurationMin,
      deep_min: 0,
      light_min: roughDurationMin,
      rem_min: 0,
    }
  }

  const stageValueSet = new Set<number>([2, 4, 5, 6])
  const detailedSet = new Set<number>([4, 5, 6])
  const parsed = parsedResult.intervals.filter((item) => stageValueSet.has(item.stage))
  const hasDetailed = parsed.some((item) => detailedSet.has(item.stage))
  const effective = parsed
    .filter((item) => (hasDetailed ? detailedSet.has(item.stage) : stageValueSet.has(item.stage)))
    .map((item) => [item.start, item.end] as [number, number])

  const deepIntervals = parsed
    .filter((item) => item.stage === 5)
    .map((item) => [item.start, item.end] as [number, number])
  const lightIntervals = parsed
    .filter((item) => item.stage === 4)
    .map((item) => [item.start, item.end] as [number, number])
  const remIntervals = parsed
    .filter((item) => item.stage === 6)
    .map((item) => [item.start, item.end] as [number, number])

  const totalMinutes = effective.length > 0 ? mergedIntervalMinutes(effective) : 0
  const deepMin = mergedIntervalMinutes(deepIntervals)
  let lightMin = mergedIntervalMinutes(lightIntervals)
  const remMin = mergedIntervalMinutes(remIntervals)

  // Some payloads only provide "sleep/awake" stages without deep/light/rem detail.
  if (!hasDetailed && totalMinutes > 0 && deepMin === 0 && lightMin === 0 && remMin === 0) {
    lightMin = totalMinutes
  }

  return {
    total_minutes: totalMinutes,
    deep_min: deepMin,
    light_min: lightMin,
    rem_min: remMin,
  }
}

function extractIsoClockHHmm(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const matched = value.match(/T(\d{2}):(\d{2})/)
  if (!matched) {
    return null
  }
  return `${matched[1] ?? '00'}:${matched[2] ?? '00'}`
}

function parseClockMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }
  const matched = value.match(/^(\d{2}):(\d{2})$/)
  if (!matched) {
    return null
  }
  const hours = Number.parseInt(matched[1] ?? '', 10)
  const mins = Number.parseInt(matched[2] ?? '', 10)
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
    return null
  }
  return hours * 60 + mins
}

function formatClockMinutes(value: number): string {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function averageClockMinutes(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  let x = 0
  let y = 0
  for (const value of values) {
    const radians = (value / 1440) * Math.PI * 2
    x += Math.cos(radians)
    y += Math.sin(radians)
  }
  if (x === 0 && y === 0) {
    return null
  }
  let angle = Math.atan2(y, x)
  if (angle < 0) {
    angle += Math.PI * 2
  }
  return (angle / (Math.PI * 2)) * 1440
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')
  return `{${body}}`
}

async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeRecordKey(_deviceId: string, record: SyncRecordInput): Promise<string> {
  const source = (record.source ?? '').trim()
  if (record.recordId && record.recordId.trim()) {
    // v2: do not include deviceId. Same Health Connect record should map to one row
    // even when app reinstall changes local deviceId.
    return `rid2|${record.type}|${source}|${record.recordId.trim()}`
  }

  const base = {
    type: record.type,
    source,
    startTime: record.startTime ?? null,
    endTime: record.endTime ?? null,
    time: record.time ?? null,
    payload: record.payload ?? {},
  }
  return sha256Hex(stableStringify(base))
}

function addBySource(map: Map<string, number>, day: string, source: string, value: number): void {
  const key = `${day}\t${source}`
  map.set(key, (map.get(key) ?? 0) + value)
}

function collapseDaySourceMax(map: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [key, value] of map.entries()) {
    const split = key.indexOf('\t')
    const day = split >= 0 ? key.slice(0, split) : key
    const current = out.get(day)
    if (current == null || value > current) {
      out.set(day, value)
    }
  }
  return out
}

function setLatestValue(
  map: Map<string, { ts: number; value: number }>,
  day: string,
  timestampMs: number,
  value: number,
): void {
  const current = map.get(day)
  if (!current || timestampMs >= current.ts) {
    map.set(day, { ts: timestampMs, value })
  }
}

function extractDistanceKm(payload: Record<string, unknown>): number | null {
  const km = findNumber(payload, new Set(['inKilometers', 'kilometers']))
  if (km != null) {
    return km
  }
  const meters = findNumber(payload, new Set(['distance', 'inMeters', 'meters']))
  if (meters != null) {
    return meters / 1000
  }
  const miles = findNumber(payload, new Set(['inMiles', 'miles']))
  if (miles != null) {
    return miles * 1.609344
  }
  return null
}

function extractEnergyKcal(payload: Record<string, unknown>): number | null {
  return findNumber(payload, new Set(['inKilocalories', 'kilocalories', 'kcal', 'energy']))
}

function extractBmrKcal(payload: Record<string, unknown>): number | null {
  const kcal = findNumber(payload, new Set(['kilocaloriesPerDay', 'inKilocaloriesPerDay']))
  if (kcal != null) {
    return kcal
  }
  const watts = findNumber(payload, new Set(['watts', 'inWatts']))
  if (watts != null) {
    return (watts * 86400) / 4184
  }
  return null
}

function normalizeBmrKcal(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  if (value < MIN_VALID_BMR_KCAL_PER_DAY || value > MAX_VALID_BMR_KCAL_PER_DAY) {
    return null
  }
  return value
}

function extractBloodPressure(payload: Record<string, unknown>): { systolic: number; diastolic: number } | null {
  const sysContainer =
    payload.systolic && typeof payload.systolic === 'object' && !Array.isArray(payload.systolic)
      ? (payload.systolic as Record<string, unknown>)
      : payload
  const diaContainer =
    payload.diastolic && typeof payload.diastolic === 'object' && !Array.isArray(payload.diastolic)
      ? (payload.diastolic as Record<string, unknown>)
      : payload
  const systolic =
    findNumber(sysContainer, new Set(['inMillimetersOfMercury', 'millimetersOfMercury', 'mmHg', 'value'])) ??
    findNumber(payload, new Set(['systolic']))
  const diastolic =
    findNumber(diaContainer, new Set(['inMillimetersOfMercury', 'millimetersOfMercury', 'mmHg', 'value'])) ??
    findNumber(payload, new Set(['diastolic']))
  if (systolic == null || diastolic == null) {
    return null
  }
  return { systolic, diastolic }
}

async function pruneDetailedHealthRecords(db: D1Database): Promise<void> {
  if (PRUNABLE_RECORD_TYPES.length === 0) {
    return
  }
  const cutoffIso = new Date(Date.now() - DETAILED_RETENTION_DAYS * MILLIS_PER_DAY).toISOString()
  const placeholders = PRUNABLE_RECORD_TYPES.map(() => '?').join(', ')
  await execute(
    db,
    `
    DELETE FROM health_records
    WHERE type IN (${placeholders})
      AND COALESCE(time, end_time, start_time) < ?
    `,
    [...PRUNABLE_RECORD_TYPES, cutoffIso],
  )
}

async function rebuildAggregatesFromHealthRecords(db: D1Database): Promise<void> {
  await pruneDetailedHealthRecords(db)
  const mutableStartDate = isoDateFromMillis(Date.now() - DETAILED_RETENTION_DAYS * MILLIS_PER_DAY)
  const mutableStartIso = `${mutableStartDate}T00:00:00.000Z`

  const typeCounts = new Map<string, number>()
  const typeRows = await queryAll<{ type: string; count: number }>(
    db,
    `
    SELECT type, COUNT(*) AS count
    FROM health_records
    GROUP BY type
    `,
  )
  for (const row of typeRows) {
    if (row.type) {
      typeCounts.set(row.type, row.count ?? 0)
    }
  }
  const recordCountByDay = new Map<string, number>()

  const stepsByDaySource = new Map<string, number>()
  const distanceByDaySource = new Map<string, number>()
  const activeByDaySource = new Map<string, number>()
  const totalByDaySource = new Map<string, number>()
  const sleepMinutesByDay = new Map<string, number>()

  const weightByDay = new Map<string, { ts: number; value: number }>()
  const bodyFatByDay = new Map<string, { ts: number; value: number }>()
  const restingByDay = new Map<string, { ts: number; value: number }>()
  const heartByDay = new Map<string, { ts: number; value: number }>()
  const spo2ByDay = new Map<string, { ts: number; value: number }>()
  const bmrByDay = new Map<string, { ts: number; value: number }>()
  const bloodPressureByDay = new Map<string, { ts: number; systolic: number; diastolic: number }>()
  const batchSize = 400
  const prunablePlaceholders = PRUNABLE_RECORD_TYPES.map(() => '?').join(', ')
  let lastRecordKey: string | null = null
  for (;;) {
    const rows =
      lastRecordKey == null
        ? await queryAll<HealthRecordRow>(
            db,
            `
            SELECT
              record_key, device_id, type, record_id, source, start_time, end_time, time,
              last_modified_time, unit, payload_json, ingested_at
            FROM health_records
            WHERE (
              type NOT IN (${prunablePlaceholders})
              OR COALESCE(time, end_time, start_time) >= ?
            )
            ORDER BY record_key ASC
            LIMIT ?
            `,
            [...PRUNABLE_RECORD_TYPES, mutableStartIso, batchSize],
          )
        : await queryAll<HealthRecordRow>(
            db,
            `
            SELECT
              record_key, device_id, type, record_id, source, start_time, end_time, time,
              last_modified_time, unit, payload_json, ingested_at
            FROM health_records
            WHERE record_key > ?
              AND (
                type NOT IN (${prunablePlaceholders})
                OR COALESCE(time, end_time, start_time) >= ?
              )
            ORDER BY record_key ASC
            LIMIT ?
            `,
            [lastRecordKey, ...PRUNABLE_RECORD_TYPES, mutableStartIso, batchSize],
          )

    if (rows.length === 0) {
      break
    }

    for (const row of rows) {
      const payload = parseJsonObject(row.payload_json)
      const source = row.source?.trim() || 'unknown'
      const tsIso = row.time ?? row.end_time ?? row.start_time
      const tsMs = parseIsoToMillis(tsIso) ?? Date.now()
      const defaultDay = localDayFromIso(tsIso) ?? localDayFromIso(row.start_time) ?? localDayFromIso(row.end_time)

      let recordDay = defaultDay

      if (row.type === 'StepsRecord') {
        const day = localDayFromIso(row.start_time) ?? defaultDay
        const count = findNumber(payload, new Set(['count']))
        if (day && count != null) {
          addBySource(stepsByDaySource, day, source, count)
        }
        recordDay = day
      } else if (row.type === 'DistanceRecord') {
        const day = localDayFromIso(row.start_time) ?? defaultDay
        const km = extractDistanceKm(payload)
        if (day && km != null) {
          addBySource(distanceByDaySource, day, source, km)
        }
        recordDay = day
      } else if (row.type === 'ActiveCaloriesBurnedRecord') {
        const day = localDayFromIso(row.start_time) ?? defaultDay
        const kcal = extractEnergyKcal(payload)
        if (day && kcal != null) {
          addBySource(activeByDaySource, day, source, kcal)
        }
        recordDay = day
      } else if (row.type === 'TotalCaloriesBurnedRecord') {
        const day = localDayFromIso(row.start_time) ?? defaultDay
        const kcal = extractEnergyKcal(payload)
        if (day && kcal != null) {
          addBySource(totalByDaySource, day, source, kcal)
        }
        recordDay = day
      } else if (row.type === 'SleepSessionRecord') {
        const day = sleepBucketDay(row.start_time, row.end_time, payload)
        const minutes = extractSleepMinutes(row.start_time, row.end_time, payload)
        if (day && minutes > 0) {
          sleepMinutesByDay.set(day, (sleepMinutesByDay.get(day) ?? 0) + minutes)
        }
        recordDay = day
      } else if (row.type === 'WeightRecord') {
        const day = defaultDay
        const kg = findNumber(payload, new Set(['inKilograms', 'kilograms', 'kg', 'weight']))
        if (day && kg != null) {
          setLatestValue(weightByDay, day, tsMs, kg)
        }
      } else if (row.type === 'BodyFatRecord') {
        const day = defaultDay
        const pct = toPercent(findNumber(payload, new Set(['value', 'percentage', 'percent'])))
        if (day && pct != null) {
          setLatestValue(bodyFatByDay, day, tsMs, pct)
        }
      } else if (row.type === 'RestingHeartRateRecord') {
        const day = defaultDay
        const bpm = findNumber(payload, new Set(['beatsPerMinute', 'bpm', 'heartRate', 'value']))
        if (day && bpm != null) {
          setLatestValue(restingByDay, day, tsMs, bpm)
        }
      } else if (row.type === 'HeartRateRecord') {
        const day = defaultDay
        const bpm = findNumber(payload, new Set(['beatsPerMinute', 'bpm', 'heartRate', 'value']))
        if (day && bpm != null) {
          setLatestValue(heartByDay, day, tsMs, bpm)
        }
      } else if (row.type === 'OxygenSaturationRecord') {
        const day = defaultDay
        const pct = toPercent(findNumber(payload, new Set(['value', 'percentage', 'percent'])))
        if (day && pct != null) {
          setLatestValue(spo2ByDay, day, tsMs, pct)
        }
      } else if (row.type === 'BasalMetabolicRateRecord') {
        const day = defaultDay
        const kcalPerDay = normalizeBmrKcal(extractBmrKcal(payload))
        if (day && kcalPerDay != null) {
          setLatestValue(bmrByDay, day, tsMs, kcalPerDay)
        }
      } else if (row.type === 'BloodPressureRecord') {
        const day = defaultDay
        const bp = extractBloodPressure(payload)
        if (day && bp != null) {
          const current = bloodPressureByDay.get(day)
          if (!current || tsMs >= current.ts) {
            bloodPressureByDay.set(day, { ts: tsMs, systolic: bp.systolic, diastolic: bp.diastolic })
          }
        }
      }

      if (recordDay) {
        recordCountByDay.set(recordDay, (recordCountByDay.get(recordDay) ?? 0) + 1)
      }
    }

    lastRecordKey = rows[rows.length - 1]?.record_key ?? null
    if (rows.length < batchSize || !lastRecordKey) {
      break
    }
  }

  const intakeRows = await queryAll<{ day: string; intake_kcal: number | null }>(
    db,
    `
    SELECT local_date AS day, SUM(COALESCE(kcal, 0) * COALESCE(count, 1)) AS intake_kcal
    FROM nutrition_events
    GROUP BY local_date
    `,
  )
  const intakeByDay = new Map<string, number>()
  for (const row of intakeRows) {
    if (row.day && row.intake_kcal != null) {
      intakeByDay.set(row.day, row.intake_kcal)
    }
  }

  const stepsByDay = collapseDaySourceMax(stepsByDaySource)
  const distanceByDay = collapseDaySourceMax(distanceByDaySource)
  const activeByDay = collapseDaySourceMax(activeByDaySource)
  const totalByDay = collapseDaySourceMax(totalByDaySource)

  const days = new Set<string>()
  const collectMapKeys = (map: Map<string, unknown>): void => {
    for (const key of map.keys()) {
      days.add(key)
    }
  }
  ;[
    stepsByDay,
    distanceByDay,
    activeByDay,
    totalByDay,
    sleepMinutesByDay,
    weightByDay,
    bodyFatByDay,
    restingByDay,
    heartByDay,
    spo2ByDay,
    bmrByDay,
    bloodPressureByDay,
    intakeByDay,
    recordCountByDay,
  ].forEach((map) => collectMapKeys(map))

  await execute(db, 'DELETE FROM daily_metrics WHERE date >= ?', [mutableStartDate])
  await execute(db, 'DELETE FROM record_type_counts')

  for (const [recordType, count] of typeCounts.entries()) {
    await execute(
      db,
      'INSERT OR REPLACE INTO record_type_counts(record_type, count) VALUES(?, ?)',
      [recordType, count],
    )
  }
  await execute(
    db,
    'INSERT OR REPLACE INTO record_type_counts(record_type, count) VALUES(?, ?)',
    [LAST_AGGREGATED_AT_MS_KEY, Date.now()],
  )

  const sortedDays = [...days].sort((a, b) => a.localeCompare(b))
  for (const day of sortedDays) {
    const active = activeByDay.get(day) ?? null
    const bmr = bmrByDay.get(day)?.value ?? null
    const rawTotal = totalByDay.get(day) ?? null
    let total = rawTotal
    if (active != null && bmr != null) {
      const floor = active + bmr
      total = total == null ? floor : Math.max(total, floor)
    }
    const sleepMinutes = sleepMinutesByDay.get(day) ?? null
    const bp = bloodPressureByDay.get(day) ?? null
    await execute(
      db,
      `
      INSERT INTO daily_metrics(
        date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
        sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm, spo2_pct,
        blood_systolic, blood_diastolic, bmr_kcal, record_count
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        steps = COALESCE(excluded.steps, daily_metrics.steps),
        distance_km = COALESCE(excluded.distance_km, daily_metrics.distance_km),
        active_kcal = COALESCE(excluded.active_kcal, daily_metrics.active_kcal),
        total_kcal = COALESCE(excluded.total_kcal, daily_metrics.total_kcal),
        intake_kcal = COALESCE(excluded.intake_kcal, daily_metrics.intake_kcal),
        sleep_hours = COALESCE(excluded.sleep_hours, daily_metrics.sleep_hours),
        weight_kg = COALESCE(excluded.weight_kg, daily_metrics.weight_kg),
        body_fat_pct = COALESCE(excluded.body_fat_pct, daily_metrics.body_fat_pct),
        resting_bpm = COALESCE(excluded.resting_bpm, daily_metrics.resting_bpm),
        heart_bpm = COALESCE(excluded.heart_bpm, daily_metrics.heart_bpm),
        spo2_pct = COALESCE(excluded.spo2_pct, daily_metrics.spo2_pct),
        blood_systolic = COALESCE(excluded.blood_systolic, daily_metrics.blood_systolic),
        blood_diastolic = COALESCE(excluded.blood_diastolic, daily_metrics.blood_diastolic),
        bmr_kcal = COALESCE(excluded.bmr_kcal, daily_metrics.bmr_kcal),
        record_count = CASE
          WHEN excluded.record_count > daily_metrics.record_count THEN excluded.record_count
          ELSE daily_metrics.record_count
        END
      `,
      [
        day,
        stepsByDay.get(day) ?? null,
        distanceByDay.get(day) ?? null,
        active,
        total,
        intakeByDay.get(day) ?? null,
        sleepMinutes == null ? null : sleepMinutes / 60,
        weightByDay.get(day)?.value ?? null,
        bodyFatByDay.get(day)?.value ?? null,
        restingByDay.get(day)?.value ?? null,
        heartByDay.get(day)?.value ?? null,
        spo2ByDay.get(day)?.value ?? null,
        bp?.systolic ?? null,
        bp?.diastolic ?? null,
        bmr,
        recordCountByDay.get(day) ?? 0,
      ],
    )
  }
}

async function ensureAggregatesUpToDate(db: D1Database): Promise<void> {
  const latestIngestedRow = await queryFirst<{ latestMs: number | null }>(
    db,
    `
    SELECT MAX(CAST(strftime('%s', ingested_at) AS INTEGER) * 1000) AS latestMs
    FROM health_records
    `,
  )
  const lastAggregatedRow = await queryFirst<{ lastMs: number | null }>(
    db,
    `
    SELECT count AS lastMs
    FROM record_type_counts
    WHERE record_type = ?
    LIMIT 1
    `,
    [LAST_AGGREGATED_AT_MS_KEY],
  )

  const latestIngestedAtMs = latestIngestedRow?.latestMs ?? 0
  const lastAggregatedAtMs = lastAggregatedRow?.lastMs ?? 0
  if (latestIngestedAtMs > lastAggregatedAtMs) {
    await rebuildAggregatesFromHealthRecords(db)
  }
}

function makeDietSummary(weightSeries: Array<{ date: string; kg: number }>): Record<string, unknown> | null {
  if (weightSeries.length < 8) {
    return null
  }
  const sorted = [...weightSeries].sort((a, b) => a.date.localeCompare(b.date))
  const tail = sorted.slice(-8)
  const first = tail[0]
  const last = tail[tail.length - 1]
  if (!first || !last) {
    return null
  }
  const delta = last.kg - first.kg
  let trend: string = 'unknown'
  if (delta > 0.1) {
    trend = 'gain'
  } else if (delta > -0.1) {
    trend = 'plateau'
  } else if (delta > -0.25) {
    trend = 'slow_loss'
  } else {
    trend = 'loss'
  }
  return {
    trend,
    ma7Delta7d: Number(delta.toFixed(3)),
    estimatedDeficitKcalPerDay: Number((-(delta * 7700) / 7).toFixed(1)),
  }
}

async function buildSummary(db: D1Database): Promise<Record<string, unknown>> {
  const rows = await queryAll<DailyMetricRow>(
    db,
    `
    SELECT
      date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
      sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm,
      spo2_pct, blood_systolic, blood_diastolic, bmr_kcal, record_count
    FROM daily_metrics
    ORDER BY date ASC
    `,
  )

  const typeRows = await queryAll<{ record_type: string; count: number }>(
    db,
    'SELECT record_type, count FROM record_type_counts ORDER BY record_type ASC',
  )
  const byType = Object.fromEntries(
    typeRows
      .filter((row) => !isMetaRecordType(row.record_type))
      .map((row) => [row.record_type, row.count]),
  ) as Record<string, number>

  const healthRecordCountRow = await queryFirst<{ c: number }>(
    db,
    'SELECT COUNT(*) AS c FROM health_records',
  )
  const totalRecords =
    healthRecordCountRow?.c ??
    rows.reduce((sum, row) => sum + (row.record_count ?? 0), 0)
  if (Object.keys(byType).length === 0 && totalRecords > 0) {
    byType.DailyMetricRecord = totalRecords
  }

  const stepsByDate: Array<{ date: string; steps: number }> = []
  const distanceKmByDate: Array<{ date: string; km: number }> = []
  const weightByDate: Array<{ date: string; kg: number }> = []
  const activeCaloriesByDate: Array<{ date: string; kcal: number }> = []
  const totalCaloriesByDate: Array<{ date: string; kcal: number }> = []
  const intakeCaloriesByDate: Array<{ date: string; kcal: number }> = []
  const calorieBalanceByDate: Array<{ date: string; kcal: number }> = []
  const sleepHoursByDate: Array<{ date: string; hours: number }> = []
  const sleepMinutesByDate: Array<{ date: string; minutes: number }> = []
  const heartRateBpmByDate: Array<{ date: string; bpm: number }> = []
  const restingHeartRateBpmByDate: Array<{ date: string; bpm: number }> = []
  const oxygenSaturationPctByDate: Array<{ date: string; pct: number }> = []
  const basalMetabolicRateKcalByDate: Array<{ date: string; kcalPerDay: number; measured?: boolean }> = []
  const bodyFatPctByDate: Array<{ date: string; pct: number }> = []
  const bloodPressureByDate: Array<{ date: string; systolic: number; diastolic: number }> = []

  for (const row of rows) {
    if (row.steps != null) {
      stepsByDate.push({ date: row.date, steps: row.steps })
    }
    if (row.distance_km != null) {
      distanceKmByDate.push({ date: row.date, km: row.distance_km })
    }
    if (row.weight_kg != null) {
      weightByDate.push({ date: row.date, kg: row.weight_kg })
    }
    if (row.active_kcal != null) {
      activeCaloriesByDate.push({ date: row.date, kcal: row.active_kcal })
    }
    if (row.total_kcal != null) {
      totalCaloriesByDate.push({ date: row.date, kcal: row.total_kcal })
    }
    if (row.intake_kcal != null) {
      intakeCaloriesByDate.push({ date: row.date, kcal: row.intake_kcal })
    }
    if (row.total_kcal != null && row.intake_kcal != null) {
      calorieBalanceByDate.push({ date: row.date, kcal: row.total_kcal - row.intake_kcal })
    }
    if (row.sleep_hours != null) {
      sleepHoursByDate.push({ date: row.date, hours: Number(row.sleep_hours.toFixed(2)) })
      sleepMinutesByDate.push({ date: row.date, minutes: Number((row.sleep_hours * 60).toFixed(0)) })
    }
    if (row.heart_bpm != null) {
      heartRateBpmByDate.push({ date: row.date, bpm: row.heart_bpm })
    }
    if (row.resting_bpm != null) {
      restingHeartRateBpmByDate.push({ date: row.date, bpm: row.resting_bpm })
    }
    if (row.spo2_pct != null) {
      oxygenSaturationPctByDate.push({ date: row.date, pct: row.spo2_pct })
    }
    const validBmr = normalizeBmrKcal(row.bmr_kcal)
    if (validBmr != null) {
      basalMetabolicRateKcalByDate.push({
        date: row.date,
        kcalPerDay: validBmr,
        measured: true,
      })
    }
    if (row.body_fat_pct != null) {
      bodyFatPctByDate.push({ date: row.date, pct: row.body_fat_pct })
    }
    if (row.blood_systolic != null && row.blood_diastolic != null) {
      bloodPressureByDate.push({
        date: row.date,
        systolic: row.blood_systolic,
        diastolic: row.blood_diastolic,
      })
    }
  }

  const profile = await getUserProfile(db)
  const heightM = profile?.height_cm != null ? profile.height_cm / 100 : null
  const diet = makeDietSummary(weightByDate)

  const latestSleep = sleepHoursByDate[sleepHoursByDate.length - 1]?.hours ?? null
  const latestSteps = stepsByDate[stepsByDate.length - 1]?.steps ?? null
  const insights: Array<{ level: string; message: string }> = []
  if (rows.length === 0) {
    insights.push({
      level: 'info',
      message: '\u307e\u3060\u30c7\u30fc\u30bf\u304c\u306a\u3044\u305f\u3081\u3001\u30e2\u30c3\u30af\u6295\u5165\u5f8c\u306b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
    })
  } else {
    const sleepText = latestSleep == null ? '--' : `${latestSleep.toFixed(2)}h`
    const stepsText = latestSteps == null ? '--' : `${Math.round(latestSteps)}\u6b69`
    insights.push({
      level: 'info',
      message: `\u6700\u65b0\u306e\u6307\u6a19\u306f\u6b69\u6570 ${stepsText}\u3001\u7761\u7720 ${sleepText}\u3067\u3059\u3002`,
    })
  }

  const exerciseRows = await queryAll<{
    start_time: string | null
    end_time: string | null
    payload_json: string
  }>(
    db,
    `SELECT start_time, end_time, payload_json
     FROM health_records
     WHERE type = 'ExerciseSessionRecord'
       AND start_time IS NOT NULL
     ORDER BY start_time DESC
     LIMIT 50`,
  )
  const exerciseSessions = exerciseRows.map((row) => {
    const payload = parseJsonObject(row.payload_json)
    const startMs = row.start_time ? new Date(row.start_time).getTime() : null
    const endMs = row.end_time ? new Date(row.end_time).getTime() : null
    const durationMinutes =
      startMs != null && endMs != null ? Math.round((endMs - startMs) / 60000) : null
    return {
      date: (row.start_time ?? '').slice(0, 10),
      exerciseType: typeof payload['exerciseType'] === 'number' ? (payload['exerciseType'] as number) : 0,
      title: typeof payload['title'] === 'string' ? (payload['title'] as string) : null,
      durationMinutes,
      startTime: row.start_time ?? null,
    }
  })

  return {
    totalRecords,
    byType,
    stepsByDate,
    distanceKmByDate,
    weightByDate,
    weightDaily: weightByDate,
    activeCaloriesByDate,
    totalCaloriesByDate,
    intakeCaloriesByDate,
    calorieBalanceByDate,
    sleepMinutesByDate,
    sleepHoursByDate,
    speedKmhByDate: [],
    heartRateBpmByDate,
    restingHeartRateBpmByDate,
    oxygenSaturationPctByDate,
    basalMetabolicRateKcalByDate,
    bodyFatPctByDate,
    bodyFatByDate: bodyFatPctByDate.map((item) => ({ date: item.date, percentage: item.pct })),
    heightM,
    bmrByDate: basalMetabolicRateKcalByDate.map((item) => ({
      date: item.date,
      kcalPerDay: item.kcalPerDay,
    })),
    bloodPressureByDate,
    restingHeartRateByDate: restingHeartRateBpmByDate,
    oxygenSaturationByDate: oxygenSaturationPctByDate.map((item) => ({
      date: item.date,
      percentage: item.pct,
    })),
    distanceByDate: distanceKmByDate.map((item) => ({ date: item.date, meters: item.km * 1000 })),
    activeCalByDate: activeCaloriesByDate,
    totalCalByDate: totalCaloriesByDate,
    exerciseSessions,
    diet,
    insights,
  }
}

type HomeStatusTab = 'home' | 'health' | 'exercise' | 'meal' | 'my'
type HomeInnerTab = 'composition' | 'vital' | 'sleep'
type HomeStatusTone = 'normal' | 'warning' | 'critical'
type HomeStatusKey = 'sleep' | 'activity' | 'nutrition' | 'condition'
type ScoreColor = 'green' | 'yellow' | 'red'
type InsightType = 'positive' | 'attention' | 'threshold'
type InsightDomain = 'sleep' | 'activity' | 'nutrition' | 'condition'
type HomeAttentionSeverity = 'critical' | 'warning' | 'info' | 'positive'
type HomeAttentionCategory = 'threshold' | 'trend' | 'achievement'
type HomeAttentionIcon = 'warning' | 'down' | 'up' | 'check' | 'alert'

interface ScoreInsight {
  type: InsightType
  domain: InsightDomain
  text: string
}

interface ScoresBaseline {
  sleep: number
  activity: number
  nutrition: number
  condition: number
}

interface InsightCandidate extends ScoreInsight {
  priority: number
}

interface HomeStatusItemPayload {
  key: HomeStatusKey
  label: string
  value: string | null
  ok: boolean
  tab: HomeStatusTab
  innerTab?: HomeInnerTab
  tone?: HomeStatusTone
  progress?: number
}

interface HomeAttentionPointPayload {
  id: string
  icon: HomeAttentionIcon
  message: string
  severity: HomeAttentionSeverity
  category: HomeAttentionCategory
  navigateTo: {
    tab: HomeStatusTab
    subTab?: HomeInnerTab
  }
  dataSource: string
}

function clampPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

function progressByTarget(actual: number | null | undefined, target: number): number {
  if (actual == null || !Number.isFinite(actual) || target <= 0) {
    return 0
  }
  return clampPercent((actual / target) * 100)
}

function formatSleepLabel(sleepMinutes: number | null): string | null {
  if (sleepMinutes == null || sleepMinutes <= 0) {
    return null
  }
  const hours = Math.floor(sleepMinutes / 60)
  const minutes = sleepMinutes % 60
  return `${hours}h${String(minutes).padStart(2, '0')}m`
}

function formatRoundedWithUnit(value: number | null, unit: string): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return `${Math.round(value).toLocaleString('ja-JP')}${unit}`
}

async function buildHomeSummary(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const [
    dayRow,
    latestWeight,
    latestBp,
    mealRow,
    profileRow,
    reportRow,
    previousReportRow,
  ] = await Promise.all([
    queryFirst<{
      steps: number | null
      sleep_hours: number | null
      intake_kcal: number | null
    }>(
      db,
      `
      SELECT steps, sleep_hours, intake_kcal
      FROM daily_metrics
      WHERE date = ?
      LIMIT 1
      `,
      [date],
    ),
    queryFirst<{ weight_kg: number | null }>(
      db,
      `
      SELECT weight_kg
      FROM daily_metrics
      WHERE date <= ?
        AND weight_kg IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
      `,
      [date],
    ),
    queryFirst<{ systolic: number | null; diastolic: number | null }>(
      db,
      `
      SELECT
        blood_systolic AS systolic,
        blood_diastolic AS diastolic
      FROM daily_metrics
      WHERE date <= ?
        AND blood_systolic IS NOT NULL
        AND blood_diastolic IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
      `,
      [date],
    ),
    queryFirst<{ event_count: number; total_kcal: number | null }>(
      db,
      `
      SELECT
        COUNT(*) AS event_count,
        SUM(COALESCE(kcal, 0) * COALESCE(count, 1)) AS total_kcal
      FROM nutrition_events
      WHERE local_date = ?
      `,
      [date],
    ),
    getUserProfile(db),
    queryFirst<{ content: string; created_at: string }>(
      db,
      `
      SELECT content, created_at
      FROM ai_reports
      WHERE report_date = ?
        AND report_type = 'daily'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [date],
    ),
    queryFirst<{ report_date: string; created_at: string }>(
      db,
      `
      SELECT report_date, created_at
      FROM ai_reports
      WHERE report_type = 'daily'
        AND report_date < ?
      ORDER BY report_date DESC, created_at DESC
      LIMIT 1
      `,
      [date],
    ),
  ])

  const steps = dayRow?.steps ?? null
  const sleepHours = dayRow?.sleep_hours ?? null
  const sleepMinutes = sleepHours == null ? null : Math.round(sleepHours * 60)
  const weight = latestWeight?.weight_kg ?? null
  const intakeKcal = dayRow?.intake_kcal ?? mealRow?.total_kcal ?? null
  const mealEventCount = mealRow?.event_count ?? 0
  const bpSystolic = latestBp?.systolic ?? null
  const bpDiastolic = latestBp?.diastolic ?? null
  const hasBp = bpSystolic != null && bpDiastolic != null

  const sleepGoalMinutes =
    profileRow?.sleep_goal_minutes != null && profileRow.sleep_goal_minutes > 0
      ? profileRow.sleep_goal_minutes
      : 420
  const stepsGoal =
    profileRow?.steps_goal != null && profileRow.steps_goal > 0
      ? profileRow.steps_goal
      : 8000

  const sufficiency = {
    sleep: sleepMinutes != null && sleepMinutes > 0,
    steps: steps != null && steps >= 1000,
    weight: weight != null && Number.isFinite(weight),
    meal: (intakeKcal != null && intakeKcal > 0) || mealEventCount > 0,
    bp: hasBp,
  }

  let bpTone: HomeStatusTone = 'normal'
  if (hasBp && bpSystolic != null && bpDiastolic != null) {
    if (bpSystolic >= 140 || bpDiastolic >= 90) {
      bpTone = 'critical'
    } else if (bpSystolic >= 130 || bpDiastolic >= 85) {
      bpTone = 'warning'
    }
  }

  const statusItems: HomeStatusItemPayload[] = [
    {
      key: 'sleep',
      label: '\u7761\u7720',
      value: formatSleepLabel(sleepMinutes),
      ok: sufficiency.sleep,
      tab: 'health',
      innerTab: 'sleep',
      tone: sleepMinutes != null && sleepMinutes < sleepGoalMinutes * 0.7 ? 'warning' : 'normal',
      progress: progressByTarget(sleepMinutes, sleepGoalMinutes),
    },
    {
      key: 'activity',
      label: '\u6d3b\u52d5',
      value: formatRoundedWithUnit(steps, ''),
      ok: sufficiency.steps,
      tab: 'exercise',
      tone: steps != null && steps < stepsGoal * 0.5 ? 'warning' : 'normal',
      progress: progressByTarget(steps, stepsGoal),
    },
    {
      key: 'nutrition',
      label: '\u6804\u990a',
      value: formatRoundedWithUnit(intakeKcal, 'kcal'),
      ok: sufficiency.meal,
      tab: 'meal',
      tone: 'normal',
      progress: sufficiency.meal ? 100 : 0,
    },
    {
      key: 'condition',
      label: '\u30b3\u30f3\u30c7\u30a3\u30b7\u30e7\u30f3',
      value: hasBp && bpSystolic != null && bpDiastolic != null ? `${Math.round(bpSystolic)}/${Math.round(bpDiastolic)}` : weight == null ? null : `${weight.toFixed(1)}kg`,
      ok: sufficiency.weight || sufficiency.bp,
      tab: 'health',
      innerTab: hasBp ? 'vital' : 'composition',
      tone: hasBp ? bpTone : 'normal',
      progress: hasBp && bpSystolic != null ? clampPercent(100 - Math.max(0, bpSystolic - 120) * 2) : sufficiency.weight ? 100 : 0,
    },
  ]

  const attentionPoints: HomeAttentionPointPayload[] = []
  if (hasBp && bpSystolic != null && bpDiastolic != null) {
    if (bpTone === 'critical') {
      attentionPoints.push({
        id: `bp-critical-${date}`,
        icon: 'alert',
        message: `\u8840\u5727\u304c\u9ad8\u3081\u3067\u3059\uff08${Math.round(bpSystolic)}/${Math.round(bpDiastolic)}\uff09`,
        severity: 'critical',
        category: 'threshold',
        navigateTo: { tab: 'health', subTab: 'vital' },
        dataSource: 'blood_pressure',
      })
    } else if (bpTone === 'warning') {
      attentionPoints.push({
        id: `bp-warning-${date}`,
        icon: 'warning',
        message: `\u8840\u5727\u304c\u3084\u3084\u9ad8\u3081\u3067\u3059\uff08${Math.round(bpSystolic)}/${Math.round(bpDiastolic)}\uff09`,
        severity: 'warning',
        category: 'threshold',
        navigateTo: { tab: 'health', subTab: 'vital' },
        dataSource: 'blood_pressure',
      })
    }
  }

  if (sleepMinutes != null && sleepMinutes > 0 && sleepMinutes < sleepGoalMinutes * 0.7) {
    attentionPoints.push({
      id: `sleep-low-${date}`,
      icon: 'down',
      message: `\u7761\u7720\u6642\u9593\u304c\u77ed\u3081\u3067\u3059\uff08${formatSleepLabel(sleepMinutes)}\uff09`,
      severity: 'warning',
      category: 'trend',
      navigateTo: { tab: 'health', subTab: 'sleep' },
      dataSource: 'sleep',
    })
  } else if (sleepMinutes != null && sleepMinutes >= sleepGoalMinutes) {
    attentionPoints.push({
      id: `sleep-good-${date}`,
      icon: 'check',
      message: '\u7761\u7720\u76ee\u6a19\u3092\u9054\u6210\u3067\u304d\u3066\u3044\u307e\u3059',
      severity: 'positive',
      category: 'achievement',
      navigateTo: { tab: 'health', subTab: 'sleep' },
      dataSource: 'sleep',
    })
  }

  if (steps != null && steps > 0 && steps < stepsGoal * 0.5) {
    attentionPoints.push({
      id: `steps-low-${date}`,
      icon: 'down',
      message: '\u6d3b\u52d5\u91cf\u304c\u4f4e\u3044\u65e5\u3067\u3059\u3002\u8efd\u3044\u904b\u52d5\u3092\u304a\u3059\u3059\u3081\u3057\u307e\u3059',
      severity: 'info',
      category: 'trend',
      navigateTo: { tab: 'exercise' },
      dataSource: 'steps',
    })
  } else if (steps != null && steps >= stepsGoal) {
    attentionPoints.push({
      id: `steps-good-${date}`,
      icon: 'check',
      message: '\u6b69\u6570\u76ee\u6a19\u3092\u9054\u6210\u3067\u304d\u3066\u3044\u307e\u3059',
      severity: 'positive',
      category: 'achievement',
      navigateTo: { tab: 'exercise' },
      dataSource: 'steps',
    })
  }

  const severityWeight: Record<HomeAttentionSeverity, number> = {
    critical: 4,
    warning: 3,
    info: 2,
    positive: 1,
  }
  const categoryWeight: Record<HomeAttentionCategory, number> = {
    threshold: 1,
    trend: 2,
    achievement: 3,
  }
  attentionPoints.sort((a, b) => {
    const severityDiff = severityWeight[b.severity] - severityWeight[a.severity]
    if (severityDiff !== 0) {
      return severityDiff
    }
    const categoryDiff = categoryWeight[a.category] - categoryWeight[b.category]
    if (categoryDiff !== 0) {
      return categoryDiff
    }
    return a.id.localeCompare(b.id)
  })

  const evidences = statusItems
    .filter((item) => item.value != null && item.ok)
    .map((item) => ({
      type: item.key,
      label: item.label,
      value: item.value as string,
      tab: item.tab,
      ...(item.innerTab ? { innerTab: item.innerTab } : {}),
    }))

  return {
    date,
    report: reportRow
      ? {
          content: reportRow.content,
          created_at: reportRow.created_at,
        }
      : null,
    sufficiency,
    evidences,
    statusItems,
    attentionPoints,
    previousReport: previousReportRow
      ? {
          date: previousReportRow.report_date,
          created_at: previousReportRow.created_at,
        }
      : null,
  }
}

function resolveDateAndTime(input: Record<string, unknown>): { consumedAt: string; localDate: string } {
  const consumedAtRaw = typeof input.consumed_at === 'string' ? input.consumed_at : null
  if (consumedAtRaw) {
    const parsed = new Date(consumedAtRaw)
    if (!Number.isNaN(parsed.getTime())) {
      return {
        consumedAt: parsed.toISOString(),
        localDate: toIsoDate(parsed),
      }
    }
  }

  const localDateRaw = typeof input.local_date === 'string' ? input.local_date : null
  if (localDateRaw && isValidDate(localDateRaw)) {
    return {
      consumedAt: `${localDateRaw}T12:00:00.000Z`,
      localDate: localDateRaw,
    }
  }

  const now = new Date()
  return {
    consumedAt: now.toISOString(),
    localDate: toIsoDate(now),
  }
}

async function getNutritionDay(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const rows = await queryAll<NutritionEventRow>(
    db,
    `
    SELECT
      id, consumed_at, local_date, alias, label, count, unit,
      kcal, protein_g, fat_g, carbs_g, micros_json, note
    FROM nutrition_events
    WHERE local_date = ?
    ORDER BY consumed_at ASC, id ASC
    `,
    [date],
  )

  let kcal = 0
  let protein = 0
  let fat = 0
  let carbs = 0
  const micros: Record<string, number> = {}

  for (const row of rows) {
    const count = row.count ?? 1
    if (row.kcal != null) {
      kcal += row.kcal * count
    }
    if (row.protein_g != null) {
      protein += row.protein_g * count
    }
    if (row.fat_g != null) {
      fat += row.fat_g * count
    }
    if (row.carbs_g != null) {
      carbs += row.carbs_g * count
    }
    const rowMicros = parseMicros(row.micros_json)
    for (const [key, value] of Object.entries(rowMicros)) {
      micros[key] = (micros[key] ?? 0) + value * count
    }
  }

  return {
    date,
    events: rows.map((row) => ({
      id: row.id,
      consumed_at: row.consumed_at,
      local_date: row.local_date,
      alias: row.alias,
      label: row.label,
      count: row.count,
      kcal: row.kcal,
      protein_g: row.protein_g,
      fat_g: row.fat_g,
      carbs_g: row.carbs_g,
    })),
    totals: {
      kcal: toNullableSum(kcal),
      protein_g: toNullableSum(protein),
      fat_g: toNullableSum(fat),
      carbs_g: toNullableSum(carbs),
      micros,
    },
  }
}

async function getUserProfile(db: D1Database): Promise<UserProfileRow> {
  const row = await queryFirst<UserProfileRow>(
    db,
    `
    SELECT
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal,
      weight_goal, bp_goal_systolic, bp_goal_diastolic,
      lens_weight, lens_bp, lens_sleep, lens_performance,
      exercise_freq, exercise_type, exercise_intensity,
      created_at, updated_at
    FROM user_profiles
    WHERE user_id = ?
    `,
    [PROFILE_USER_ID],
  )
  return sanitizeUserProfileRow(row)
}

function applyUserProfilePatch(base: UserProfileRow, payload: Record<string, unknown>): UserProfileRow {
  const unknownKeys = Object.keys(payload).filter((key) => !USER_PROFILE_PATCH_KEYS.has(key))
  if (unknownKeys.length > 0) {
    throw new ValidationError(`Unknown fields: ${unknownKeys.join(', ')}`)
  }

  const next: UserProfileRow = {
    ...base,
    user_id: PROFILE_USER_ID,
  }

  if (hasOwn(payload, 'age')) {
    next.age = payload.age == null ? null : toValidatedInteger(payload.age, 'age', 0, 130)
  }
  if (hasOwn(payload, 'gender')) {
    next.gender = payload.gender == null ? null : toValidatedEnum(payload.gender, 'gender', GENDER_VALUES)
  }
  if (hasOwn(payload, 'height_cm')) {
    next.height_cm = payload.height_cm == null ? null : toValidatedNumber(payload.height_cm, 'height_cm', 80, 250)
  }
  if (hasOwn(payload, 'goal_weight_kg')) {
    next.goal_weight_kg =
      payload.goal_weight_kg == null
        ? null
        : toValidatedNumber(payload.goal_weight_kg, 'goal_weight_kg', 20, 300)
  }
  if (hasOwn(payload, 'sleep_goal_minutes')) {
    next.sleep_goal_minutes =
      payload.sleep_goal_minutes == null
        ? 420
        : toValidatedInteger(payload.sleep_goal_minutes, 'sleep_goal_minutes', 180, 900)
  }
  if (hasOwn(payload, 'steps_goal')) {
    next.steps_goal =
      payload.steps_goal == null
        ? 8000
        : toValidatedInteger(payload.steps_goal, 'steps_goal', 1000, 50000)
  }
  if (hasOwn(payload, 'weight_goal')) {
    next.weight_goal =
      payload.weight_goal == null
        ? null
        : toValidatedEnum(payload.weight_goal, 'weight_goal', WEIGHT_GOAL_VALUES)
  }
  if (hasOwn(payload, 'bp_goal_systolic')) {
    next.bp_goal_systolic =
      payload.bp_goal_systolic == null
        ? null
        : toValidatedInteger(payload.bp_goal_systolic, 'bp_goal_systolic', 70, 250)
  }
  if (hasOwn(payload, 'bp_goal_diastolic')) {
    next.bp_goal_diastolic =
      payload.bp_goal_diastolic == null
        ? null
        : toValidatedInteger(payload.bp_goal_diastolic, 'bp_goal_diastolic', 40, 150)
  }
  if (hasOwn(payload, 'lens_weight')) {
    const flag = normalizeLensFlag(payload.lens_weight)
    if (flag == null) {
      throw new ValidationError('lens_weight must be 0 or 1')
    }
    next.lens_weight = flag
  }
  if (hasOwn(payload, 'lens_bp')) {
    const flag = normalizeLensFlag(payload.lens_bp)
    if (flag == null) {
      throw new ValidationError('lens_bp must be 0 or 1')
    }
    next.lens_bp = flag
  }
  if (hasOwn(payload, 'lens_sleep')) {
    const flag = normalizeLensFlag(payload.lens_sleep)
    if (flag == null) {
      throw new ValidationError('lens_sleep must be 0 or 1')
    }
    next.lens_sleep = flag
  }
  if (hasOwn(payload, 'lens_performance')) {
    const flag = normalizeLensFlag(payload.lens_performance)
    if (flag == null) {
      throw new ValidationError('lens_performance must be 0 or 1')
    }
    next.lens_performance = flag
  }
  if (hasOwn(payload, 'exercise_freq')) {
    next.exercise_freq =
      payload.exercise_freq == null
        ? null
        : toValidatedEnum(payload.exercise_freq, 'exercise_freq', EXERCISE_FREQ_VALUES)
  }
  if (hasOwn(payload, 'exercise_type')) {
    next.exercise_type =
      payload.exercise_type == null
        ? null
        : toValidatedEnum(payload.exercise_type, 'exercise_type', EXERCISE_TYPE_VALUES)
  }
  if (hasOwn(payload, 'exercise_intensity')) {
    next.exercise_intensity =
      payload.exercise_intensity == null
        ? null
        : toValidatedEnum(payload.exercise_intensity, 'exercise_intensity', EXERCISE_INTENSITY_VALUES)
  }

  if (
    next.bp_goal_systolic != null &&
    next.bp_goal_diastolic != null &&
    next.bp_goal_diastolic >= next.bp_goal_systolic
  ) {
    throw new ValidationError('bp_goal_diastolic must be lower than bp_goal_systolic')
  }

  return next
}

async function upsertUserProfile(db: D1Database, payload: Record<string, unknown>): Promise<UserProfileRow> {
  const current = await getUserProfile(db)
  const next = applyUserProfilePatch(current, payload)
  const timestamp = nowIso()

  await execute(
    db,
    `
    INSERT INTO user_profiles(
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal,
      weight_goal, bp_goal_systolic, bp_goal_diastolic,
      lens_weight, lens_bp, lens_sleep, lens_performance,
      exercise_freq, exercise_type, exercise_intensity, updated_at
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      age = excluded.age,
      gender = excluded.gender,
      height_cm = excluded.height_cm,
      goal_weight_kg = excluded.goal_weight_kg,
      sleep_goal_minutes = excluded.sleep_goal_minutes,
      steps_goal = excluded.steps_goal,
      weight_goal = excluded.weight_goal,
      bp_goal_systolic = excluded.bp_goal_systolic,
      bp_goal_diastolic = excluded.bp_goal_diastolic,
      lens_weight = excluded.lens_weight,
      lens_bp = excluded.lens_bp,
      lens_sleep = excluded.lens_sleep,
      lens_performance = excluded.lens_performance,
      exercise_freq = excluded.exercise_freq,
      exercise_type = excluded.exercise_type,
      exercise_intensity = excluded.exercise_intensity,
      updated_at = excluded.updated_at
    `,
    [
      PROFILE_USER_ID,
      next.age,
      next.gender,
      next.height_cm,
      next.goal_weight_kg,
      next.sleep_goal_minutes,
      next.steps_goal,
      next.weight_goal,
      next.bp_goal_systolic,
      next.bp_goal_diastolic,
      next.lens_weight,
      next.lens_bp,
      next.lens_sleep,
      next.lens_performance,
      next.exercise_freq,
      next.exercise_type,
      next.exercise_intensity,
      timestamp,
    ],
  )

  return getUserProfile(db)
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function weightedAverage(
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

function minimum(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return Math.min(...valid)
}

function estimateBmrKcal(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  ageYears: number | null | undefined,
  gender: SexType | null | undefined,
): number | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null
  }

  const safeHeight = heightCm != null && Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 172
  const safeAge = ageYears != null && Number.isFinite(ageYears) ? Math.max(15, Math.min(90, Math.round(ageYears))) : 38
  const safeSex: SexType = gender === 'female' || gender === 'other' || gender === 'male' ? gender : 'male'

  const bmr =
    safeSex === 'female'
      ? 447.593 + 9.247 * weightKg + 3.098 * safeHeight - 4.33 * safeAge
      : 88.362 + 13.397 * weightKg + 4.799 * safeHeight - 5.677 * safeAge

  return Number.isFinite(bmr) ? bmr : null
}

function roundOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value)
}

function normalizeBodyFatPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

function metricLabels(baseDate: string, period: MetricPeriod): string[] {
  if (period === 'year') {
    const baseYm = toYearMonth(baseDate)
    const startYm = shiftYearMonth(baseYm, -11)
    return Array.from({ length: 12 }, (_, index) => shiftYearMonth(startYm, index))
  }

  const days = period === 'week' ? 7 : 30
  const startDate = shiftIsoDateByDays(baseDate, -(days - 1))
  return Array.from({ length: days }, (_, index) => shiftIsoDateByDays(startDate, index))
}

function latestDateOf<T extends { date: string }>(items: T[], predicate: (item: T) => boolean): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    if (predicate(item)) {
      return item.date
    }
  }
  return null
}

async function getBodyData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
  const labels = metricLabels(baseDate, period)
  const startDate = period === 'year' ? `${labels[0]}-01` : labels[0]

  const rows = period === 'year'
    ? await queryAll<{
        bucket: string
        weight_kg: number | null
        body_fat_pct: number | null
        bmr_kcal: number | null
      }>(
        db,
        `
        SELECT
          substr(date, 1, 7) AS bucket,
          AVG(weight_kg) AS weight_kg,
          AVG(NULLIF(body_fat_pct, 0)) AS body_fat_pct,
          AVG(bmr_kcal) AS bmr_kcal
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [startDate, baseDate],
      )
    : await queryAll<{
        bucket: string
        weight_kg: number | null
        body_fat_pct: number | null
        bmr_kcal: number | null
      }>(
        db,
        `
        SELECT
          date AS bucket,
          weight_kg,
          body_fat_pct,
          bmr_kcal
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC
        `,
        [startDate, baseDate],
      )

  const latestWeight = await queryFirst<{
    weight_kg: number | null
  }>(
    db,
    `
    SELECT weight_kg
    FROM daily_metrics
    WHERE date <= ?
      AND weight_kg IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )
  const latestBodyFat = await queryFirst<{
    body_fat_pct: number | null
  }>(
    db,
    `
    SELECT body_fat_pct
    FROM daily_metrics
    WHERE date <= ?
      AND body_fat_pct IS NOT NULL
      AND body_fat_pct > 0
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )
  const latestBmr = await queryFirst<{
    bmr_kcal: number | null
  }>(
    db,
    `
    SELECT bmr_kcal
    FROM daily_metrics
    WHERE date <= ?
      AND bmr_kcal IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )

  const profile = await getUserProfile(db)

  const currentWeight = latestWeight?.weight_kg ?? null
  const currentBodyFat = normalizeBodyFatPct(latestBodyFat?.body_fat_pct ?? null)
  const fallbackWeight = currentWeight ?? profile?.goal_weight_kg ?? null
  const byBucket = new Map(rows.map((row) => [row.bucket, row]))
  const series = labels.map((label) => {
    const row = byBucket.get(label)
    const rowWeight = row?.weight_kg ?? null
    return {
      date: label,
      weight_kg: rowWeight,
      body_fat_pct: normalizeBodyFatPct(row?.body_fat_pct ?? null),
      bmr_kcal:
        normalizeBmrKcal(row?.bmr_kcal) ??
        estimateBmrKcal(
          rowWeight ?? fallbackWeight,
          profile?.height_cm ?? null,
          profile?.age ?? null,
          profile?.gender ?? null,
        ),
    }
  })

  const currentBmr =
    normalizeBmrKcal(latestBmr?.bmr_kcal) ??
    estimateBmrKcal(
      currentWeight ?? profile?.goal_weight_kg ?? null,
      profile?.height_cm ?? null,
      profile?.age ?? null,
      profile?.gender ?? null,
    )
  const heightM = profile?.height_cm != null && profile.height_cm > 0 ? profile.height_cm / 100 : null
  const currentBmi = heightM != null && currentWeight != null ? currentWeight / (heightM * heightM) : null
  const avgWeight = average(series.map((item) => item.weight_kg))
  const avgBodyFat = average(series.map((item) => item.body_fat_pct))
  const avgBmi = heightM != null && avgWeight != null ? avgWeight / (heightM * heightM) : null

  return {
    baseDate,
    period,
    current: {
      weight_kg: currentWeight,
      body_fat_pct: currentBodyFat,
      bmi: currentBmi,
      bmr_kcal: currentBmr,
    },
    goalWeight: profile?.goal_weight_kg ?? null,
    series,
    periodSummary: {
      avg_weight_kg: avgWeight,
      avg_body_fat_pct: avgBodyFat,
      avg_bmi: avgBmi,
      points: series.filter((item) => item.weight_kg != null).length,
    },
  }
}

interface SleepRecordDailyStats {
  sleep_minutes: number
  deep_min: number
  light_min: number
  rem_min: number
  bedtime: string | null
  wake_time: string | null
  latest_end_ms: number
}

interface SleepBucketStats extends SleepRecordDailyStats {
  day_count: number
}

async function collectSleepRecordStatsByDay(
  db: D1Database,
  startDate: string,
  endDate: string,
): Promise<{
  by_day: Map<string, SleepRecordDailyStats>
  avg_bedtime: string | null
  avg_wake_time: string | null
}> {
  const queryStart = shiftIsoDateByDays(startDate, -2)
  const queryEnd = shiftIsoDateByDays(endDate, 2)
  const rows = await queryAll<{
    start_time: string | null
    end_time: string | null
    payload_json: string
  }>(
    db,
    `
    SELECT start_time, end_time, payload_json
    FROM health_records
    WHERE type = 'SleepSessionRecord'
      AND (
        (start_time IS NOT NULL AND substr(start_time, 1, 10) BETWEEN ? AND ?)
        OR (end_time IS NOT NULL AND substr(end_time, 1, 10) BETWEEN ? AND ?)
      )
    ORDER BY COALESCE(end_time, start_time) ASC
    `,
    [queryStart, queryEnd, queryStart, queryEnd],
  )

  const byDay = new Map<string, SleepRecordDailyStats>()
  const bedtimeMinutes: number[] = []
  const wakeMinutes: number[] = []

  for (const row of rows) {
    const payload = parseJsonObject(row.payload_json)
    const day = sleepBucketDay(row.start_time, row.end_time, payload)
    if (!day || day < startDate || day > endDate) {
      continue
    }

    const breakdown = extractSleepStageBreakdown(row.start_time, row.end_time, payload)
    const fallbackSleepMinutes = extractSleepMinutes(row.start_time, row.end_time, payload)
    const totalSleepMinutes = breakdown.total_minutes > 0 ? breakdown.total_minutes : fallbackSleepMinutes

    const bed = extractIsoClockHHmm(row.start_time)
    const wake = extractIsoClockHHmm(row.end_time)
    const bedMin = parseClockMinutes(bed)
    const wakeMin = parseClockMinutes(wake)
    if (bedMin != null) {
      bedtimeMinutes.push(bedMin)
    }
    if (wakeMin != null) {
      wakeMinutes.push(wakeMin)
    }

    const endMs = parseIsoToMillis(row.end_time) ?? parseIsoToMillis(row.start_time) ?? 0
    const existing = byDay.get(day)
    if (!existing) {
      byDay.set(day, {
        sleep_minutes: totalSleepMinutes,
        deep_min: breakdown.deep_min,
        light_min: breakdown.light_min,
        rem_min: breakdown.rem_min,
        bedtime: bed,
        wake_time: wake,
        latest_end_ms: endMs,
      })
      continue
    }

    existing.sleep_minutes += totalSleepMinutes
    existing.deep_min += breakdown.deep_min
    existing.light_min += breakdown.light_min
    existing.rem_min += breakdown.rem_min
    if (endMs >= existing.latest_end_ms) {
      existing.latest_end_ms = endMs
      existing.bedtime = bed
      existing.wake_time = wake
    }
  }

  const avgBedtimeMin = averageClockMinutes(bedtimeMinutes)
  const avgWakeMin = averageClockMinutes(wakeMinutes)
  return {
    by_day: byDay,
    avg_bedtime: avgBedtimeMin == null ? null : formatClockMinutes(avgBedtimeMin),
    avg_wake_time: avgWakeMin == null ? null : formatClockMinutes(avgWakeMin),
  }
}

async function getSleepData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
  const labels = metricLabels(baseDate, period)
  const startDate = period === 'year' ? `${labels[0]}-01` : labels[0]

  const rows = period === 'year'
    ? await queryAll<{
        bucket: string
        sleep_hours: number | null
        spo2_pct: number | null
      }>(
        db,
        `
        SELECT
          substr(date, 1, 7) AS bucket,
          AVG(sleep_hours) AS sleep_hours,
          AVG(spo2_pct) AS spo2_pct
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [startDate, baseDate],
      )
    : await queryAll<{
        bucket: string
        sleep_hours: number | null
        spo2_pct: number | null
      }>(
        db,
        `
        SELECT
          date AS bucket,
          sleep_hours,
          spo2_pct
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC
        `,
        [startDate, baseDate],
      )

  const byBucket = new Map(rows.map((row) => [row.bucket, row]))
  const sleepRecordStats = await collectSleepRecordStatsByDay(db, startDate, baseDate)
  const sleepStatsByBucket = new Map<string, SleepBucketStats>()
  if (period === 'year') {
    for (const [day, stats] of sleepRecordStats.by_day.entries()) {
      const bucket = toYearMonth(day)
      const existing = sleepStatsByBucket.get(bucket)
      if (!existing) {
        sleepStatsByBucket.set(bucket, { ...stats, day_count: 1 })
        continue
      }
      existing.sleep_minutes += stats.sleep_minutes
      existing.deep_min += stats.deep_min
      existing.light_min += stats.light_min
      existing.rem_min += stats.rem_min
      existing.day_count += 1
      if (stats.latest_end_ms >= existing.latest_end_ms) {
        existing.latest_end_ms = stats.latest_end_ms
        existing.bedtime = stats.bedtime
        existing.wake_time = stats.wake_time
      }
    }
  } else {
    for (const [day, stats] of sleepRecordStats.by_day.entries()) {
      sleepStatsByBucket.set(day, { ...stats, day_count: 1 })
    }
  }

  const series = labels.map((label) => {
    const row = byBucket.get(label)
    const recordStats = sleepStatsByBucket.get(label)
    const recordDays = recordStats != null ? Math.max(1, recordStats.day_count) : 1
    const sleepMinutes =
      recordStats != null
        ? roundOrNull(period === 'year' ? recordStats.sleep_minutes / recordDays : recordStats.sleep_minutes)
        : row?.sleep_hours != null
          ? Math.round(row.sleep_hours * 60)
          : null
    return {
      date: label,
      sleep_minutes: sleepMinutes,
      deep_min: recordStats != null ? roundOrNull(period === 'year' ? recordStats.deep_min / recordDays : recordStats.deep_min) : null,
      light_min: recordStats != null ? roundOrNull(period === 'year' ? recordStats.light_min / recordDays : recordStats.light_min) : null,
      rem_min: recordStats != null ? roundOrNull(period === 'year' ? recordStats.rem_min / recordDays : recordStats.rem_min) : null,
      spo2_pct: row?.spo2_pct ?? null,
    }
  })

  const current = await queryFirst<{
    date: string
    sleep_hours: number | null
    spo2_pct: number | null
  }>(
    db,
    `
    SELECT date, sleep_hours, spo2_pct
    FROM daily_metrics
    WHERE date <= ?
      AND (sleep_hours IS NOT NULL OR spo2_pct IS NOT NULL)
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )

  const profile = await getUserProfile(db)
  const goalMinutes = profile?.sleep_goal_minutes ?? 420
  const latestSleepDate = latestDateOf(series, (item) => item.sleep_minutes != null)
  const latestSleepPoint = latestSleepDate == null ? null : series.find((item) => item.date === latestSleepDate) ?? null
  const latestSleepRecord = latestSleepDate == null ? null : sleepStatsByBucket.get(latestSleepDate) ?? null
  const dayLevelStats = Array.from(sleepRecordStats.by_day.values())
  const sleepMinutesSeries =
    period === 'year' && dayLevelStats.length > 0
      ? dayLevelStats.map((item) => roundOrNull(item.sleep_minutes))
      : series.map((item) => item.sleep_minutes)
  const avgSleepMinutes = average(sleepMinutesSeries)
  const avgDeepMin =
    period === 'year' && dayLevelStats.length > 0
      ? average(dayLevelStats.map((item) => roundOrNull(item.deep_min)))
      : average(series.map((item) => item.deep_min))
  const avgLightMin =
    period === 'year' && dayLevelStats.length > 0
      ? average(dayLevelStats.map((item) => roundOrNull(item.light_min)))
      : average(series.map((item) => item.light_min))
  const avgRemMin =
    period === 'year' && dayLevelStats.length > 0
      ? average(dayLevelStats.map((item) => roundOrNull(item.rem_min)))
      : average(series.map((item) => item.rem_min))
  const avgSpo2 = average(series.map((item) => item.spo2_pct))
  const minSpo2 = minimum(series.map((item) => item.spo2_pct))
  const goalDays = sleepMinutesSeries.filter((value) => value != null && value >= goalMinutes).length
  const measuredDays = sleepMinutesSeries.filter((value) => value != null).length
  const deepRatio = avgSleepMinutes != null && avgSleepMinutes > 0 && avgDeepMin != null ? avgDeepMin / avgSleepMinutes : null
  const lightRatio =
    avgSleepMinutes != null && avgSleepMinutes > 0 && avgLightMin != null ? avgLightMin / avgSleepMinutes : null
  const remRatio = avgSleepMinutes != null && avgSleepMinutes > 0 && avgRemMin != null ? avgRemMin / avgSleepMinutes : null
  const stageSummaryForCard =
    period === 'week' && latestSleepPoint != null
      ? {
          deep_min: latestSleepPoint.deep_min ?? roundOrNull(avgDeepMin),
          light_min: latestSleepPoint.light_min ?? roundOrNull(avgLightMin),
          rem_min: latestSleepPoint.rem_min ?? roundOrNull(avgRemMin),
        }
      : {
          deep_min: roundOrNull(avgDeepMin),
          light_min: roundOrNull(avgLightMin),
          rem_min: roundOrNull(avgRemMin),
        }

  return {
    baseDate,
    period,
    current: {
      sleep_minutes:
        latestSleepPoint?.sleep_minutes ?? (current?.sleep_hours != null ? Math.round(current.sleep_hours * 60) : null),
      bedtime: latestSleepRecord?.bedtime ?? sleepRecordStats.avg_bedtime ?? null,
      wake_time: latestSleepRecord?.wake_time ?? sleepRecordStats.avg_wake_time ?? null,
      avg_spo2: current?.spo2_pct ?? avgSpo2 ?? null,
      min_spo2: current?.spo2_pct ?? minSpo2 ?? null,
    },
    stages: stageSummaryForCard,
    series: series.map((item) => ({
      date: item.date,
      sleep_minutes: item.sleep_minutes,
      deep_min: item.deep_min,
      light_min: item.light_min,
      rem_min: item.rem_min,
    })),
    periodSummary: {
      avg_sleep_min: avgSleepMinutes,
      goal_days: goalDays,
      measured_days: measuredDays,
      goal_rate: measuredDays > 0 ? goalDays / measuredDays : null,
      avg_deep_min: avgDeepMin,
      avg_light_min: avgLightMin,
      avg_rem_min: avgRemMin,
      deep_ratio: deepRatio,
      light_ratio: lightRatio,
      rem_ratio: remRatio,
      avg_spo2: avgSpo2,
      min_spo2: minSpo2,
    },
    latestSleepDate,
  }
}

async function getVitalsData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
  const labels = metricLabels(baseDate, period)
  const startDate = period === 'year' ? `${labels[0]}-01` : labels[0]

  const rows = period === 'year'
    ? await queryAll<{
        bucket: string
        systolic: number | null
        diastolic: number | null
        resting_hr: number | null
        heart_hr: number | null
      }>(
        db,
        `
        SELECT
          substr(date, 1, 7) AS bucket,
          AVG(blood_systolic) AS systolic,
          AVG(blood_diastolic) AS diastolic,
          AVG(resting_bpm) AS resting_hr,
          AVG(heart_bpm) AS heart_hr
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [startDate, baseDate],
      )
    : await queryAll<{
        bucket: string
        systolic: number | null
        diastolic: number | null
        resting_hr: number | null
        heart_hr: number | null
      }>(
        db,
        `
        SELECT
          date AS bucket,
          blood_systolic AS systolic,
          blood_diastolic AS diastolic,
          resting_bpm AS resting_hr,
          heart_bpm AS heart_hr
        FROM daily_metrics
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC
        `,
        [startDate, baseDate],
      )

  const byBucket = new Map(rows.map((row) => [row.bucket, row]))
  const series = labels.map((label) => {
    const row = byBucket.get(label)
    return {
      date: label,
      systolic: row?.systolic ?? null,
      diastolic: row?.diastolic ?? null,
      resting_hr: row?.resting_hr ?? row?.heart_hr ?? null,
      heart_hr: row?.heart_hr ?? null,
    }
  })

  const latestBp = await queryFirst<{
    systolic: number | null
    diastolic: number | null
  }>(
    db,
    `
    SELECT
      blood_systolic AS systolic,
      blood_diastolic AS diastolic
    FROM daily_metrics
    WHERE date <= ?
      AND blood_systolic IS NOT NULL
      AND blood_diastolic IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )
  const latestResting = await queryFirst<{
    resting_hr: number | null
    heart_hr: number | null
  }>(
    db,
    `
    SELECT
      resting_bpm AS resting_hr,
      heart_bpm AS heart_hr
    FROM daily_metrics
    WHERE date <= ?
      AND (resting_bpm IS NOT NULL OR heart_bpm IS NOT NULL)
    ORDER BY date DESC
    LIMIT 1
    `,
    [baseDate],
  )

  return {
    baseDate,
    period,
    current: {
      systolic: latestBp?.systolic ?? null,
      diastolic: latestBp?.diastolic ?? null,
      resting_hr: latestResting?.resting_hr ?? latestResting?.heart_hr ?? null,
      heart_hr: latestResting?.heart_hr ?? null,
    },
    series,
    periodSummary: {
      avg_systolic: average(series.map((item) => item.systolic)),
      avg_diastolic: average(series.map((item) => item.diastolic)),
      avg_resting_hr: average(series.map((item) => item.resting_hr)),
      avg_heart_hr: average(series.map((item) => item.heart_hr)),
      high_bp_points: series.filter((item) => {
        if (item.systolic == null || item.diastolic == null) {
          return false
        }
        return item.systolic >= 130 || item.diastolic >= 85
      }).length,
    },
  }
}

function parsePermissionsJson(value: string | null | undefined): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return normalizeStringArray(parsed)
  } catch {
    return []
  }
}

async function getHealthConnectPermissionStatus(db: D1Database): Promise<Record<string, unknown>> {
  const snapshot = await queryFirst<{
    required_permissions_json: string | null
    granted_permissions_json: string | null
    received_at: string | null
  }>(
    db,
    `
    SELECT required_permissions_json, granted_permissions_json, received_at
    FROM sync_permission_snapshots
    WHERE lower(device_id) NOT LIKE '%smoke%'
    ORDER BY received_at DESC
    LIMIT 1
    `,
  )

  const snapshotRequired = parsePermissionsJson(snapshot?.required_permissions_json)
  const snapshotGranted = parsePermissionsJson(snapshot?.granted_permissions_json)
  const required = snapshotRequired.length > 0 ? snapshotRequired : [...HEALTH_CONNECT_REQUIRED_PERMISSIONS]

  let granted: string[]
  let source: string
  if (snapshotGranted.length > 0) {
    granted = snapshotGranted
    source = 'sync_payload'
  } else {
    const typeRows = await queryAll<{ type: string; c: number }>(
      db,
      `
      SELECT type, COUNT(*) AS c
      FROM health_records
      GROUP BY type
      `,
    )
    const grantedSet = new Set<string>()
    for (const row of typeRows) {
      if ((row.c ?? 0) <= 0) {
        continue
      }
      const permission = RECORD_PERMISSION_MAP[row.type]
      if (permission) {
        grantedSet.add(permission)
      }
    }
    granted = Array.from(grantedSet).sort((a, b) => a.localeCompare(b))
    source = 'inferred_from_records'
  }

  const grantedSet = new Set(granted)
  const missing = required.filter((permission) => !grantedSet.has(permission))

  return {
    source,
    required,
    granted,
    missing,
    required_count: required.length,
    granted_count: granted.length,
    is_fully_granted: missing.length === 0,
    updated_at: snapshot?.received_at ?? null,
  }
}

function statusByRule(actual: number | null, target: number, rule: 'range' | 'min' | 'max'): 'green' | 'yellow' | 'red' {
  if (actual == null || !Number.isFinite(actual)) {
    return rule === 'max' ? 'green' : 'red'
  }
  const ratio = target > 0 ? actual / target : 0
  if (rule === 'range') {
    if (ratio >= 0.8 && ratio <= 1.2) {
      return 'green'
    }
    if (ratio >= 0.6 && ratio <= 1.5) {
      return 'yellow'
    }
    return 'red'
  }
  if (rule === 'min') {
    if (ratio >= 1.0) {
      return 'green'
    }
    if (ratio >= 0.7) {
      return 'yellow'
    }
    return 'red'
  }
  if (ratio <= 1.0) {
    return 'green'
  }
  if (ratio <= 1.2) {
    return 'yellow'
  }
  return 'red'
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreColor(score: number): ScoreColor {
  if (score >= 70) {
    return 'green'
  }
  if (score >= 50) {
    return 'yellow'
  }
  return 'red'
}

function sleepAbsoluteScore(row: Pick<DailyMetricRow, 'sleep_hours' | 'spo2_pct'>, goalMinutes: number): number | null {
  if (row.sleep_hours == null || !Number.isFinite(row.sleep_hours) || row.sleep_hours <= 0) {
    return null
  }

  const sleepMinutes = row.sleep_hours * 60
  const ratio = goalMinutes > 0 ? sleepMinutes / goalMinutes : 0
  let durationScore: number
  if (ratio <= 1) {
    durationScore = ratio * 100
  } else if (ratio <= 1.2) {
    durationScore = 100 - (ratio - 1) * 25
  } else {
    durationScore = 95 - (ratio - 1.2) * 50
  }

  let qualityScore = 75
  if (row.spo2_pct != null && Number.isFinite(row.spo2_pct)) {
    if (row.spo2_pct >= 97) {
      qualityScore = 100
    } else if (row.spo2_pct >= 95) {
      qualityScore = 85
    } else if (row.spo2_pct >= 93) {
      qualityScore = 70
    } else {
      qualityScore = 50
    }
  }

  return clampScore(durationScore * 0.8 + qualityScore * 0.2)
}

function bodyAbsoluteScore(
  row: Pick<DailyMetricRow, 'weight_kg' | 'body_fat_pct'>,
  profile: UserProfileRow,
): number | null {
  const scores: number[] = []
  if (row.weight_kg != null && Number.isFinite(row.weight_kg) && row.weight_kg > 0) {
    const goalWeight = profile.goal_weight_kg
    if (goalWeight != null && Number.isFinite(goalWeight) && goalWeight > 0) {
      const diffRatio = Math.abs(row.weight_kg - goalWeight) / goalWeight
      scores.push(clampScore(100 - diffRatio * 250))
    } else {
      scores.push(80)
    }
  }

  if (row.body_fat_pct != null && Number.isFinite(row.body_fat_pct) && row.body_fat_pct > 0) {
    const targetBodyFat = profile.gender === 'female' ? 28 : 20
    const diff = Math.abs(row.body_fat_pct - targetBodyFat)
    scores.push(clampScore(100 - diff * 4))
  }

  return scores.length > 0 ? clampScore(scores.reduce((sum, item) => sum + item, 0) / scores.length) : null
}

function bpAbsoluteScore(row: Pick<DailyMetricRow, 'blood_systolic' | 'blood_diastolic'>): number | null {
  const sys = row.blood_systolic
  const dia = row.blood_diastolic
  if (sys == null || dia == null || !Number.isFinite(sys) || !Number.isFinite(dia)) {
    return null
  }

  if (sys < 120 && dia < 80) {
    return 95
  }
  if (sys < 130 && dia < 85) {
    return 80
  }
  if (sys < 140 && dia < 90) {
    return 60
  }
  if (sys < 160 && dia < 100) {
    return 40
  }
  return 20
}

function activityAbsoluteScore(
  row: Pick<DailyMetricRow, 'steps' | 'active_kcal' | 'distance_km'>,
  stepsGoal: number,
): number | null {
  const scores: number[] = []

  if (row.steps != null && Number.isFinite(row.steps) && row.steps >= 0) {
    const ratio = stepsGoal > 0 ? row.steps / stepsGoal : 0
    scores.push(clampScore(Math.min(100, ratio * 100)))
  }

  if (row.active_kcal != null && Number.isFinite(row.active_kcal) && row.active_kcal >= 0) {
    const ratio = row.active_kcal / 300
    scores.push(clampScore(Math.min(100, ratio * 100)))
  }

  if (row.distance_km != null && Number.isFinite(row.distance_km) && row.distance_km >= 0) {
    const ratio = row.distance_km / 5
    scores.push(clampScore(Math.min(100, ratio * 100)))
  }

  return scores.length > 0 ? clampScore(scores.reduce((sum, item) => sum + item, 0) / scores.length) : null
}

function nutritionAbsoluteScore(row: Pick<DailyMetricRow, 'intake_kcal' | 'bmr_kcal'>): number | null {
  if (row.intake_kcal == null || !Number.isFinite(row.intake_kcal) || row.intake_kcal < 0) {
    return null
  }

  const bmrKcal = row.bmr_kcal != null && Number.isFinite(row.bmr_kcal) && row.bmr_kcal > 0 ? row.bmr_kcal : DEFAULT_BMR_KCAL
  const ratio = row.intake_kcal / bmrKcal

  let score: number
  if (ratio >= 0.9 && ratio <= 1.4) {
    // 1.15 中心で 100、範囲端（0.9, 1.4）で 90 となる勾配
    score = 100 - Math.abs(ratio - 1.15) * 40
  } else if (ratio >= 0.7 && ratio < 0.9) {
    score = 70 - (0.9 - ratio) * 100
  } else if (ratio > 1.4 && ratio <= 1.8) {
    score = 70 - (ratio - 1.4) * 75
  } else {
    score = Math.max(20, 50 - Math.abs(ratio - 1.15) * 30)
  }

  return clampScore(score)
}

function conditionAbsoluteScore(
  row: Pick<
    DailyMetricRow,
    'blood_systolic' | 'blood_diastolic' | 'resting_bpm' | 'weight_kg' | 'body_fat_pct'
  >,
  profile: UserProfileRow,
): number | null {
  const scores: Array<number | null> = []
  const weights: number[] = []

  const bpScore = bpAbsoluteScore(row)
  scores.push(bpScore)
  weights.push(3)

  let hrScore: number | null = null
  if (row.resting_bpm != null && Number.isFinite(row.resting_bpm)) {
    if (row.resting_bpm < 60) {
      hrScore = 95
    } else if (row.resting_bpm < 70) {
      hrScore = 85
    } else if (row.resting_bpm < 80) {
      hrScore = 70
    } else if (row.resting_bpm < 90) {
      hrScore = 55
    } else {
      hrScore = 40
    }
  }
  scores.push(hrScore)
  weights.push(2)

  const bodyScore = bodyAbsoluteScore(row, profile)
  scores.push(bodyScore)
  weights.push(2)

  return weightedAverage(scores, weights)
}

function trendScore(currentScore: number, baselineScore: number): number {
  return clampScore(100 - Math.abs(currentScore - baselineScore) * 1.2)
}

function hasInsightMetric(row: DailyMetricRow): boolean {
  return (
    (row.sleep_hours != null && Number.isFinite(row.sleep_hours)) ||
    (row.spo2_pct != null && Number.isFinite(row.spo2_pct)) ||
    (row.distance_km != null && Number.isFinite(row.distance_km)) ||
    (row.intake_kcal != null && Number.isFinite(row.intake_kcal)) ||
    (row.bmr_kcal != null && Number.isFinite(row.bmr_kcal)) ||
    (row.weight_kg != null && Number.isFinite(row.weight_kg)) ||
    (row.body_fat_pct != null && Number.isFinite(row.body_fat_pct)) ||
    (row.blood_systolic != null && Number.isFinite(row.blood_systolic)) ||
    (row.blood_diastolic != null && Number.isFinite(row.blood_diastolic)) ||
    (row.resting_bpm != null && Number.isFinite(row.resting_bpm)) ||
    (row.steps != null && Number.isFinite(row.steps)) ||
    (row.active_kcal != null && Number.isFinite(row.active_kcal))
  )
}

function generateInsights(
  todayRow: DailyMetricRow | null,
  rows: DailyMetricRow[],
  baseline: ScoresBaseline,
  profile: UserProfileRow,
): ScoreInsight[] {
  if (todayRow == null || !hasInsightMetric(todayRow)) {
    return []
  }

  const historyRows = rows.filter((row) => row.date !== todayRow.date)
  const historyMetricDays = historyRows.filter((row) => hasInsightMetric(row)).length
  if (historyMetricDays < 3) {
    return []
  }

  const sleepGoalMinutes = profile.sleep_goal_minutes > 0 ? profile.sleep_goal_minutes : 420
  const stepsGoal = profile.steps_goal > 0 ? profile.steps_goal : 8000

  const currentDomainScores: Record<InsightDomain, number | null> = {
    sleep: sleepAbsoluteScore(todayRow, sleepGoalMinutes),
    activity: activityAbsoluteScore(todayRow, stepsGoal),
    nutrition: nutritionAbsoluteScore(todayRow),
    condition: conditionAbsoluteScore(todayRow, profile),
  }

  const historyCounts: Record<InsightDomain, number> = {
    sleep: historyRows.map((row) => sleepAbsoluteScore(row, sleepGoalMinutes)).filter((score) => score != null).length,
    activity: historyRows.map((row) => activityAbsoluteScore(row, stepsGoal)).filter((score) => score != null).length,
    nutrition: historyRows.map((row) => nutritionAbsoluteScore(row)).filter((score) => score != null).length,
    condition: historyRows.map((row) => conditionAbsoluteScore(row, profile)).filter((score) => score != null).length,
  }

  const candidates: InsightCandidate[] = []
  const addCandidate = (candidate: InsightCandidate): void => {
    const duplicate = candidates.some(
      (item) => item.type === candidate.type && item.domain === candidate.domain && item.text === candidate.text,
    )
    if (!duplicate) {
      candidates.push({ ...candidate })
    }
  }

  const sys = todayRow.blood_systolic
  const dia = todayRow.blood_diastolic
  if (sys != null && dia != null && Number.isFinite(sys) && Number.isFinite(dia)) {
    if (sys > 135 || dia > 85) {
      const severity = Math.max(0, sys - 135) + Math.max(0, dia - 85)
      addCandidate({
        type: 'threshold',
        domain: 'condition',
        text: '今日の血圧は高めでした。塩分を控えて、早めに休みましょう。',
        priority: 120 + severity,
      })
    } else if (sys < 130 && dia < 85) {
      addCandidate({
        type: 'positive',
        domain: 'condition',
        text: '今日の血圧は落ち着いていて、安定した状態を保てています。',
        priority: 55,
      })
    }
  }

  const positiveMessages: Record<InsightDomain, string> = {
    sleep: '睡眠の調子がいつもより良く、体をしっかり休められています。',
    activity: '活動量がいつもよりしっかり確保できています。',
    nutrition: '食事バランスがいつもより良好です。',
    condition: 'コンディションがいつもより良い状態です。',
  }
  const attentionMessages: Record<InsightDomain, string> = {
    sleep: '睡眠の調子がいつもより落ちています。今夜は少し早めに休みましょう。',
    activity: '活動量がいつもより少なめです。短い散歩から戻していきましょう。',
    nutrition: '食事バランスがいつもより崩れています。摂取量を整えましょう。',
    condition: 'コンディションがいつもより不安定です。無理をせず体調管理を優先しましょう。',
  }

  ;(['sleep', 'activity', 'nutrition', 'condition'] as InsightDomain[]).forEach((domain) => {
    const score = currentDomainScores[domain]
    const historyCount = historyCounts[domain]
    const domainBaseline = baseline[domain]
    if (score == null || historyCount < 3 || !Number.isFinite(domainBaseline) || domainBaseline <= 0) {
      return
    }

    const deviation = (score - domainBaseline) / domainBaseline
    const magnitude = Math.abs(deviation)
    if (magnitude < 0.2) {
      return
    }

    if (deviation > 0) {
      addCandidate({
        type: 'positive',
        domain,
        text: positiveMessages[domain],
        priority: 70 + magnitude * 40,
      })
      return
    }

    addCandidate({
      type: 'attention',
      domain,
      text: attentionMessages[domain],
      priority: 90 + magnitude * 40,
    })
  })

  const sleepMinutes =
    todayRow.sleep_hours != null && Number.isFinite(todayRow.sleep_hours) ? Math.round(todayRow.sleep_hours * 60) : null
  if (sleepMinutes != null && sleepMinutes >= sleepGoalMinutes) {
    addCandidate({
      type: 'positive',
      domain: 'sleep',
      text: '睡眠目標を達成できました。回復のリズムが整っています。',
      priority: 65,
    })
  }

  if (todayRow.steps != null && Number.isFinite(todayRow.steps) && todayRow.steps >= stepsGoal) {
    addCandidate({
      type: 'positive',
      domain: 'activity',
      text: '歩数目標を達成できました。よく体を動かせています。',
      priority: 66,
    })
  }

  if (
    todayRow.weight_kg != null &&
    Number.isFinite(todayRow.weight_kg) &&
    profile.goal_weight_kg != null &&
    Number.isFinite(profile.goal_weight_kg) &&
    Math.abs(todayRow.weight_kg - profile.goal_weight_kg) <= 1
  ) {
    addCandidate({
      type: 'positive',
      domain: 'condition',
      text: '体重が目標に近い位置で安定しています。',
      priority: 64,
    })
  }

  if (!candidates.some((item) => item.type === 'positive')) {
    addCandidate({
      type: 'positive',
      domain: 'activity',
      text: '今日の記録を続けられています。この積み重ねが体調管理につながります。',
      priority: 40,
    })
  }

  return [...candidates]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ priority, ...insight }) => ({ ...insight }))
}

function sleepSummary(row: Pick<DailyMetricRow, 'sleep_hours'> | null, profile: UserProfileRow): string {
  if (!row || row.sleep_hours == null || row.sleep_hours <= 0) {
    return '\u7761\u7720\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093'
  }
  const minutes = Math.round(row.sleep_hours * 60)
  const goal = profile.sleep_goal_minutes > 0 ? profile.sleep_goal_minutes : 420
  if (minutes >= goal) {
    return '\u7761\u7720\u76ee\u6a19\u3092\u9054\u6210'
  }
  if (minutes >= goal * 0.8) {
    return '\u7761\u7720\u306f\u6982\u306d\u5b89\u5b9a'
  }
  return '\u7761\u7720\u6642\u9593\u304c\u77ed\u3081'
}

function bodySummary(row: Pick<DailyMetricRow, 'weight_kg'> | null, profile: UserProfileRow): string {
  if (!row || row.weight_kg == null || row.weight_kg <= 0) {
    return '\u8eab\u4f53\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093'
  }
  if (profile.goal_weight_kg != null && profile.goal_weight_kg > 0) {
    const diff = row.weight_kg - profile.goal_weight_kg
    if (Math.abs(diff) <= 1.0) {
      return '\u4f53\u91cd\u306f\u76ee\u6a19\u4ed8\u8fd1\u3067\u5b89\u5b9a'
    }
    return diff > 0 ? '\u4f53\u91cd\u306f\u76ee\u6a19\u3088\u308a\u9ad8\u3081' : '\u4f53\u91cd\u306f\u76ee\u6a19\u3088\u308a\u4f4e\u3081'
  }
  return '\u8eab\u4f53\u30c7\u30fc\u30bf\u3092\u7d99\u7d9a\u8a08\u6e2c\u4e2d'
}

function bpSummary(row: Pick<DailyMetricRow, 'blood_systolic' | 'blood_diastolic'> | null): string {
  const sys = row?.blood_systolic
  const dia = row?.blood_diastolic
  if (sys == null || dia == null) {
    return '\u8840\u5727\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093'
  }
  if (sys < 130 && dia < 85) {
    return '\u8840\u5727\u306f\u6b63\u5e38\u7bc4\u56f2'
  }
  if (sys < 140 && dia < 90) {
    return '\u8840\u5727\u306f\u3084\u3084\u9ad8\u3081'
  }
  return '\u8840\u5727\u304c\u9ad8\u3081'
}

function activitySummary(row: Pick<DailyMetricRow, 'steps'> | null, profile: UserProfileRow): string {
  const steps = row?.steps
  if (steps == null || steps < 0) {
    return '\u6d3b\u52d5\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093'
  }
  const goal = profile.steps_goal > 0 ? profile.steps_goal : 8000
  const ratio = goal > 0 ? steps / goal : 0
  if (ratio >= 1) {
    return '\u6b69\u6570\u76ee\u6a19\u3092\u9054\u6210'
  }
  if (ratio >= 0.7) {
    return '\u6b69\u6570\u306f\u76ee\u6a19\u306b\u63a5\u8fd1'
  }
  return '\u6b69\u6570\u304c\u76ee\u6a19\u672a\u9054'
}

function nutritionSummary(row: Pick<DailyMetricRow, 'intake_kcal' | 'bmr_kcal'> | null): string {
  if (!row || row.intake_kcal == null || !Number.isFinite(row.intake_kcal)) {
    return '食事データがありません'
  }
  const bmrKcal = row.bmr_kcal != null && Number.isFinite(row.bmr_kcal) && row.bmr_kcal > 0 ? row.bmr_kcal : DEFAULT_BMR_KCAL
  const ratio = row.intake_kcal / bmrKcal
  if (ratio < 0.8) {
    return '摂取カロリーがやや少なめです'
  }
  if (ratio <= 1.5) {
    return 'カロリーバランスは良好です'
  }
  return '摂取カロリーがやや多めです'
}

function conditionSummary(
  row: Pick<DailyMetricRow, 'blood_systolic' | 'blood_diastolic' | 'resting_bpm' | 'weight_kg' | 'body_fat_pct'> | null,
  profile: UserProfileRow,
): string {
  if (!row) {
    return 'コンディションデータがありません'
  }

  const totalScore = conditionAbsoluteScore(row, profile)
  if (totalScore != null && totalScore >= 70) {
    return 'コンディションは良好です'
  }

  const bpScore = bpAbsoluteScore(row)
  const bodyScore = bodyAbsoluteScore(row, profile)

  if (bpScore != null && bodyScore != null) {
    return bpScore <= bodyScore ? bpSummary(row) : bodySummary(row, profile)
  }
  if (bpScore != null) {
    return bpSummary(row)
  }
  if (bodyScore != null) {
    return bodySummary(row, profile)
  }
  if (row.resting_bpm != null && Number.isFinite(row.resting_bpm)) {
    return row.resting_bpm < 80 ? 'コンディションは良好です' : '安静時心拍がやや高めです'
  }

  return 'コンディションデータがありません'
}

async function getScores(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const profile = await getUserProfile(db)
  const startDate = shiftIsoDateByDays(date, -14)
  const rows = await queryAll<DailyMetricRow>(
    db,
    `
    SELECT
      date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
      sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm, spo2_pct,
      blood_systolic, blood_diastolic, bmr_kcal, record_count
    FROM daily_metrics
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC
    `,
    [startDate, date],
  )

  const byDate = new Map(rows.map((row) => [row.date, row]))
  const current = byDate.get(date) ?? null
  const history = rows.filter((row) => row.date !== date)

  const sleepGoalMinutes = profile.sleep_goal_minutes > 0 ? profile.sleep_goal_minutes : 420
  const stepsGoal = profile.steps_goal > 0 ? profile.steps_goal : 8000

  const sleepHistoryScores = history.map((row) => sleepAbsoluteScore(row, sleepGoalMinutes))
  const activityHistoryScores = history.map((row) => activityAbsoluteScore(row, stepsGoal))
  const nutritionHistoryScores = history.map((row) => nutritionAbsoluteScore(row))
  const conditionHistoryScores = history.map((row) => conditionAbsoluteScore(row, profile))

  const baselineSleep = clampScore(average(sleepHistoryScores) ?? DEFAULT_BASELINE_SCORE.sleep)
  const baselineActivity = clampScore(average(activityHistoryScores) ?? DEFAULT_BASELINE_SCORE.activity)
  const baselineNutrition = clampScore(average(nutritionHistoryScores) ?? DEFAULT_BASELINE_SCORE.nutrition)
  const baselineCondition = clampScore(average(conditionHistoryScores) ?? DEFAULT_BASELINE_SCORE.condition)

  const currentSleepAbs = current == null ? null : sleepAbsoluteScore(current, sleepGoalMinutes)
  const currentActivityAbs = current == null ? null : activityAbsoluteScore(current, stepsGoal)
  const currentNutritionAbs = current == null ? null : nutritionAbsoluteScore(current)
  const currentConditionAbs = current == null ? null : conditionAbsoluteScore(current, profile)

  const sleepScore =
    currentSleepAbs == null ? null : clampScore(currentSleepAbs * 0.7 + trendScore(currentSleepAbs, baselineSleep) * 0.3)
  const activityScore =
    currentActivityAbs == null
      ? null
      : clampScore(currentActivityAbs * 0.7 + trendScore(currentActivityAbs, baselineActivity) * 0.3)
  const nutritionScore =
    currentNutritionAbs == null
      ? null
      : clampScore(currentNutritionAbs * 0.7 + trendScore(currentNutritionAbs, baselineNutrition) * 0.3)
  const conditionScore =
    currentConditionAbs == null
      ? null
      : clampScore(currentConditionAbs * 0.7 + trendScore(currentConditionAbs, baselineCondition) * 0.3)

  const domains = {
    sleep:
      sleepScore == null
        ? null
        : {
            score: sleepScore,
            color: scoreColor(sleepScore),
            summary: sleepSummary(current, profile),
          },
    activity:
      activityScore == null
        ? null
        : {
            score: activityScore,
            color: scoreColor(activityScore),
            summary: activitySummary(current, profile),
          },
    nutrition:
      nutritionScore == null
        ? null
        : {
            score: nutritionScore,
            color: scoreColor(nutritionScore),
            summary: nutritionSummary(current),
          },
    condition:
      conditionScore == null
        ? null
        : {
            score: conditionScore,
            color: scoreColor(conditionScore),
            summary: conditionSummary(current, profile),
          },
  }

  const overallValue = average([sleepScore, activityScore, nutritionScore, conditionScore])
  const overall =
    overallValue == null
      ? null
      : {
          score: clampScore(overallValue),
          color: scoreColor(clampScore(overallValue)),
        }

  const baseline: ScoresBaseline = {
    sleep: baselineSleep,
    activity: baselineActivity,
    nutrition: baselineNutrition,
    condition: baselineCondition,
  }
  const insights = generateInsights(current, rows, baseline, profile)

  return {
    date,
    overall,
    domains,
    baseline: { ...baseline },
    insights,
  }
}

async function readOptionalJsonBody(request: Request, maxBytes = 65536): Promise<Record<string, unknown>> {
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

interface DailyReportTrendRow {
  date: string
  steps: number | null
  sleep_hours: number | null
  weight_kg: number | null
  blood_systolic: number | null
  blood_diastolic: number | null
  intake_kcal: number | null
  active_kcal: number | null
  total_kcal: number | null
}

interface DailyReportGenerationResult {
  payload: DailyReportGeneratedPayload
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

interface DailyReportPersistInput extends DailyReportGeneratedPayload {
  date: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generated_at: string
}

function stripReportEmoji(value: string): string {
  return value.replace(REPORT_EMOJI_RE, '')
}

function normalizeDailyReportText(value: unknown, field: string, minLength = 20, maxLength = 320): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }
  const normalized = stripReportEmoji(value).replace(/\s+/g, ' ').trim()
  if (!normalized) {
    throw new Error(`${field} must not be empty`)
  }
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new Error(`${field} length is out of range`)
  }
  return normalized
}

function extractJsonObjectCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    return fenced[1].trim()
  }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || start >= end) {
    throw new Error('LLM response did not include a JSON object')
  }
  return raw.slice(start, end + 1).trim()
}

function parseDailyReportGeneratedPayload(raw: string): DailyReportGeneratedPayload {
  const candidate = extractJsonObjectCandidate(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error('LLM response is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LLM response JSON must be an object')
  }

  const root = parsed as Record<string, unknown>
  const home = root.home
  const tabs = root.tabs
  if (!home || typeof home !== 'object' || Array.isArray(home)) {
    throw new Error('LLM response must include home object')
  }
  if (!tabs || typeof tabs !== 'object' || Array.isArray(tabs)) {
    throw new Error('LLM response must include tabs object')
  }

  const homeObject = home as Record<string, unknown>
  const tabsObject = tabs as Record<string, unknown>

  return {
    headline: normalizeDailyReportText(root.headline, 'headline', 5, 120),
    yu_comment: normalizeDailyReportText(homeObject.yu, 'home.yu', 20, 320),
    saki_comment: normalizeDailyReportText(homeObject.saki, 'home.saki', 20, 320),
    mai_comment: normalizeDailyReportText(homeObject.mai, 'home.mai', 20, 320),
    condition_comment: normalizeDailyReportText(tabsObject.condition, 'tabs.condition', 20, 320),
    activity_comment: normalizeDailyReportText(tabsObject.activity, 'tabs.activity', 20, 320),
    meal_comment: normalizeDailyReportText(tabsObject.meal, 'tabs.meal', 20, 320),
  }
}

function buildSeasonContext(date: string): Record<string, string> {
  const month = Number.parseInt(date.slice(5, 7), 10)
  if (month >= 3 && month <= 5) {
    return {
      season: '春',
      context: '寒暖差と花粉の影響が出やすい時期です。水分補給と睡眠の質を意識してください。',
    }
  }
  if (month >= 6 && month <= 8) {
    return {
      season: '夏',
      context: '暑さで体力を消耗しやすい時期です。脱水と睡眠不足に注意してください。',
    }
  }
  if (month >= 9 && month <= 11) {
    return {
      season: '秋',
      context: '活動しやすい季節です。運動習慣を定着させる好機です。',
    }
  }
  return {
    season: '冬',
    context: '冷えと乾燥で体調が揺らぎやすい時期です。血圧管理と保温を重視してください。',
  }
}

function buildTrendSummary(rows: DailyReportTrendRow[]): Record<string, unknown> {
  const latest = rows[rows.length - 1] ?? null
  const first = rows[0] ?? null
  const avgSteps = average(rows.map((row) => row.steps))
  const avgSleepHours = average(rows.map((row) => row.sleep_hours))
  const avgIntakeKcal = average(rows.map((row) => row.intake_kcal))
  const avgActiveKcal = average(rows.map((row) => row.active_kcal))
  const avgSystolic = average(rows.map((row) => row.blood_systolic))
  const avgDiastolic = average(rows.map((row) => row.blood_diastolic))
  const latestWeight = latest?.weight_kg ?? null
  const firstWeight = first?.weight_kg ?? null
  const weightDiff =
    latestWeight != null && firstWeight != null ? Number((latestWeight - firstWeight).toFixed(2)) : null

  return {
    observed_days: rows.length,
    latest: latest
      ? {
          ...latest,
        }
      : null,
    averages: {
      steps: avgSteps == null ? null : Math.round(avgSteps),
      sleep_hours: avgSleepHours == null ? null : Number(avgSleepHours.toFixed(2)),
      intake_kcal: avgIntakeKcal == null ? null : Math.round(avgIntakeKcal),
      active_kcal: avgActiveKcal == null ? null : Math.round(avgActiveKcal),
      blood_pressure: avgSystolic == null || avgDiastolic == null ? null : `${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}`,
    },
    change: {
      steps:
        latest?.steps != null && first?.steps != null
          ? Math.round(latest.steps - first.steps)
          : null,
      sleep_hours:
        latest?.sleep_hours != null && first?.sleep_hours != null
          ? Number((latest.sleep_hours - first.sleep_hours).toFixed(2))
          : null,
      weight_kg: weightDiff,
    },
  }
}

function buildDailyReportPrompt(params: {
  date: string
  season: Record<string, string>
  profile: UserProfileRow
  scores: Record<string, unknown>
  trendRows: DailyReportTrendRow[]
}): { systemPrompt: string; userPrompt: string } {
  const { date, season, profile, scores, trendRows } = params
  const trendSummary = buildTrendSummary(trendRows)

  const systemPrompt = [
    'あなたは健康管理アプリ「Health OS」の専属AIライターです。',
    'ユーザーの健康データを読み取り、3人の専門家キャラクターになりきって日次コメントを生成します。',
    '',
    '# 絶対ルール',
    '- 出力はJSON1つだけ。前後に文章・説明・マークダウンフェンスを付けない',
    '- 提供されたデータに基づく事実だけを書く。数値を作らない、診断しない',
    '- 「ダメ」「やめて」「〜してはいけない」など否定表現は禁止。肯定的な言い換えにする',
    '- 絵文字は一切使わない',
    '- 各コメントは80〜150文字（日本語）',
    '- データがnullの領域は触れずにスキップする',
    '',
    '# 比較の基準',
    '- 「高め」「低め」「改善」「悪化」を判断する基準は、医学基準ではなくユーザー個人の14日平均（ベースライン）を使う',
    '- 例: 血圧の14日平均が132/82で今日が129/86なら「平均より少し下がっています」が正しい',
    '- 医学的な正常値に触れる場合は「一般的な基準では〜」と明示する',
    '',
    '# コメントの構成ルール',
    '- 各コメントは「事実の確認→ポジティブな解釈or具体的な提案」の順にする',
    '- 数値が悪くても、まず客観的に事実を述べ、次に具体的で実行可能なアクションを1つ提案する',
    '- 「頑張りましょう」「意識しましょう」のような抽象的な励ましは避け、具体的な行動を提案する',
    '  - 悪い例: 「歩数を増やす工夫を始めてみましょう」',
    '  - 良い例: 「昼食後に10分だけ近所を歩くと、無理なく2000歩ほど上乗せできますよ」',
    '',
    '# home と tabs の役割分担',
    '- home（ホーム画面）: その専門家が今日一番伝えたいこと1つに絞る。概要として機能する',
    '- tabs（タブ画面）: homeとは別の切り口で書く。具体的なデータ比較・トレンド分析・行動提案を含める',
    '- homeとtabsで同じ話題を繰り返してはならない。例えばhomeで血圧に触れたら、tabsでは体重や心拍など別の指標に焦点を当てる',
  ].join('\n')

  const userPrompt = [
    `# 対象日: ${date}`,
    `季節: ${season.season}（${season.context}）`,
    '',
    '---',
    '# ユーザー情報',
    `- 年齢: ${profile.age ?? '不明'}歳、性別: ${profile.gender === 'male' ? '男性' : profile.gender === 'female' ? '女性' : '未設定'}`,
    `- 身長: ${profile.height_cm ?? '不明'}cm、目標体重: ${profile.goal_weight_kg ?? '未設定'}kg`,
    `- 歩数目標: ${profile.steps_goal ?? '未設定'}歩/日、睡眠目標: ${profile.sleep_goal_minutes ? `${Math.round(profile.sleep_goal_minutes / 60)}時間` : '未設定'}`,
    `- 運動頻度: ${profile.exercise_freq ?? '未設定'}、運動種目: ${profile.exercise_type ?? '未設定'}`,
    '',
    '---',
    '# 今日のスコア（0〜100点、高いほど良い）',
    `- 総合: ${(scores as Record<string, unknown>).overall ? JSON.stringify((scores as Record<string, unknown>).overall) : 'データなし'}`,
    `- 各領域: ${JSON.stringify((scores as Record<string, unknown>).domains)}`,
    `  - score: 0-100の点数。80以上=良好(green)、50-79=注意(yellow)、50未満=要改善(red)、null=データなし`,
    `- 14日平均スコア（ベースライン）: ${JSON.stringify((scores as Record<string, unknown>).baseline)}`,
    '',
    '# 気づき（ルールエンジンが検出した注目ポイント）',
    `${JSON.stringify((scores as Record<string, unknown>).insights)}`,
    '- type: "positive"=良い傾向, "attention"=注意, "threshold"=基準値超過',
    '',
    '# 過去14日トレンド',
    JSON.stringify(trendSummary),
    '- averages: 14日間の平均値',
    '- change: 初日→最新日の変化量（正=増加、負=減少）',
    '',
    '---',
    '# キャラクター定義',
    '',
    '## ユウ先生（内科医・男性）',
    '担当: homeのyuコメント + tabsのconditionコメント',
    'トーン: 穏やかで安心感がある。データを噛み砕いて丁寧に伝える。',
    '特徴: 14日平均との比較で「改善/横ばい/注意」を正確に判定する。季節と体調の関連を自然に織り込む。',
    '注意: 血圧が14日平均より下がっていれば「改善傾向」と書く。平均より上がっていれば「やや上がっている」と書く。方向を間違えない。',
    'homeの書き方: 今日のコンディションで一番伝えたいことを1つ。安心感を与える締め。',
    'tabsの書き方: homeで触れなかった指標のトレンド分析。14日間の変化と具体的な生活改善提案。',
    '例文: 「今日の血圧は14日平均より少し下がっていますね。この調子で減塩を続けていけば、安定したラインに近づいていきますよ。」',
    '',
    '## サキさん（管理栄養士・女性）',
    '担当: homeのsakiコメント + tabsのmealコメント',
    'トーン: 明るく親しみやすい。旬の食材や具体的なメニュー提案が得意。',
    '特徴: 制限ではなく「こうすると美味しいですよ」という提案型。季節の食材を具体的なメニュー名で提案する。',
    'homeの書き方: 今日の食事状況をサッと触れて、旬の食材を使った具体的な一品を提案。',
    'tabsの書き方: カロリーバランスや栄養面のトレンドを分析し、1週間単位での食事パターン改善を提案。',
    '食事記録がない場合: 「記録がない」とだけ指摘せず、記録することのメリットと、今日食べると良い具体メニューを提案する。',
    '例文: 「たんぱく質がしっかり摂れていますね。今の時期は新玉ねぎが甘くて美味しいので、スライスしてかつお節をのせるだけで立派な一品になりますよ。」',
    '',
    '## マイコーチ（パーソナルトレーナー・女性）',
    '担当: homeのmaiコメント + tabsのactivityコメント',
    'トーン: ポジティブで励まし上手。コーチとして具体的なメニューを提案する。',
    '特徴: ユーザーの運動種目・頻度を踏まえて、今日できる具体的な運動を1つ提案する。',
    '重要: 「歩数が少ない」「目標未達」という事実の報告だけではAIの価値がない。コーチとして「今日これをやろう」という具体的アクションを必ず含める。',
    `  - ユーザーの運動種目: ${profile.exercise_type ?? '未設定'}`,
    `  - ユーザーの運動頻度: ${profile.exercise_freq ?? '未設定'}`,
    'homeの書き方: 今日の活動で良かった点を見つけて褒め、+αの具体アクション1つ。',
    'tabsの書き方: 14日間の活動トレンドを分析し、週間での運動リズムを提案。歩数だけでなく消費カロリーや距離も活用。',
    '歩数が極端に少ない日: 「歩数が少ない」と繰り返さず、「今日は室内で過ごす日のようですね」と受け入れた上で、室内でできるストレッチや筋トレを提案する。',
    '例文: 「今日は室内中心の一日だったようですね。夕食前に5分だけスクワットとストレッチをすると、明日の身体が軽くなりますよ。」',
    '',
    '---',
    '# 出力フォーマット（このJSON構造を厳守）',
    JSON.stringify(
      {
        headline: '全体の状態を一言で（15〜30文字）',
        home: {
          yu: 'ユウ先生の総合コメント（80〜150文字）',
          saki: 'サキさんの栄養コメント（80〜150文字）',
          mai: 'マイコーチの運動コメント（80〜150文字）',
        },
        tabs: {
          condition: 'ユウ先生が書くコンディション詳細（80〜150文字）',
          activity: 'マイコーチが書く運動詳細（80〜150文字）',
          meal: 'サキさんが書く食事詳細（80〜150文字）',
        },
      },
      null,
      2,
    ),
  ].join('\n')

  return { systemPrompt, userPrompt }
}

async function callAnthropicDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
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
        max_tokens: 1200,
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
      } catch { /* ignore parse failure */ }
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
  if (!generatedText) {
    throw new Error('Anthropic API returned empty content')
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
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
        max_completion_tokens: /^(gpt-5|o[1-9])/.test(model) ? 16384 : 1200,
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

  const parsed = JSON.parse(rawResponse) as OpenAICompatibleResponse
  const generatedText = parsed.choices?.[0]?.message?.content?.trim() ?? ''
  if (!generatedText) {
    throw new Error('OpenAI API returned empty content')
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
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
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const geminiModel = model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

  let rawResponse = ''
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

  const parsed = JSON.parse(rawResponse) as GeminiResponse
  const parts = parsed.candidates?.[0]?.content?.parts ?? []
  // Gemini 2.5 models include "thought" parts before the actual response.
  // Find the last non-thought part which contains the generated text.
  const outputPart = [...parts].reverse().find((p) => !p.thought)
  const generatedText = (typeof outputPart?.text === 'string' ? outputPart.text : '').trim()
  if (!generatedText) {
    throw new Error(`Gemini API returned empty content. Parts count: ${parts.length}, raw snippet: ${rawResponse.slice(0, 300)}`)
  }

  const payload = parseDailyReportGeneratedPayload(generatedText)
  return {
    payload: { ...payload },
    model: parsed.modelVersion ?? geminiModel,
    prompt_tokens: typeof parsed.usageMetadata?.promptTokenCount === 'number' ? parsed.usageMetadata.promptTokenCount : null,
    completion_tokens: typeof parsed.usageMetadata?.candidatesTokenCount === 'number' ? parsed.usageMetadata.candidatesTokenCount : null,
  }
}

async function callLlmDailyReport(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyReportGenerationResult> {
  if (provider === 'openai') {
    return callOpenAIDailyReport(apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt)
  }
  if (provider === 'gemini' || provider === 'google') {
    return callGeminiDailyReport(apiKey, model || 'gemini-2.5-flash', systemPrompt, userPrompt)
  }
  return callAnthropicDailyReport(apiKey, model || DEFAULT_LLM_MODEL, systemPrompt, userPrompt)
}

async function getDailyReport(db: D1Database, date: string): Promise<DailyReportRow | null> {
  const row = await queryFirst<DailyReportRow>(
    db,
    `
    SELECT
      date, headline, yu_comment, saki_comment, mai_comment,
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

function toDailyReportResponse(row: DailyReportRow): Record<string, unknown> {
  return {
    date: row.date,
    generated_at: row.generated_at,
    model: row.model,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    home: {
      headline: row.headline,
      yu: row.yu_comment,
      saki: row.saki_comment,
      mai: row.mai_comment,
    },
    tabs: {
      condition: row.condition_comment,
      activity: row.activity_comment,
      meal: row.meal_comment,
    },
    cached: true,
  }
}

async function saveDailyReport(db: D1Database, payload: DailyReportPersistInput): Promise<void> {
  await execute(
    db,
    `
    INSERT INTO daily_reports(
      date, headline, yu_comment, saki_comment, mai_comment,
      condition_comment, activity_comment, meal_comment,
      model, prompt_tokens, completion_tokens, generated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      headline = excluded.headline,
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

async function queryDailyReportTrendRows(db: D1Database, date: string): Promise<DailyReportTrendRow[]> {
  const startDate = shiftIsoDateByDays(date, -13)
  return queryAll<DailyReportTrendRow>(
    db,
    `
    SELECT
      date, steps, sleep_hours, weight_kg, blood_systolic, blood_diastolic, intake_kcal, active_kcal, total_kcal
    FROM daily_metrics
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC
    `,
    [startDate, date],
  )
}

async function computeTargets(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const profile = await getUserProfile(db)
  const latestWeight = await queryFirst<{ weight_kg: number | null }>(
    db,
    'SELECT weight_kg FROM daily_metrics WHERE weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1',
  )
  const day = await getNutritionDay(db, date)
  const totals = day.totals as {
    kcal: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
    micros: Record<string, number>
  }

  const heightCm = profile?.height_cm ?? 172
  const age = profile?.age ?? 38
  const sex = profile?.gender ?? 'male'
  const weightKg = latestWeight?.weight_kg ?? 70

  const bmr =
    sex === 'female'
      ? 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
      : 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
  const tdee = bmr * 1.55
  const targetKcal = tdee * 0.8

  const proteinTarget = (targetKcal * 0.3) / 4
  const fatTarget = (targetKcal * 0.25) / 9
  const carbsTarget = (targetKcal * 0.45) / 4

  const microTargets: Array<{ key: string; name: string; unit: string; target: number }> = [
    { key: 'vitamin_d3_mcg', name: '\u30d3\u30bf\u30df\u30f3D', unit: '\u03bcg', target: 15 },
    { key: 'vitamin_c_mg', name: '\u30d3\u30bf\u30df\u30f3C', unit: 'mg', target: 100 },
    { key: 'vitamin_e_mg', name: '\u30d3\u30bf\u30df\u30f3E', unit: 'mg', target: sex === 'female' ? 5 : 6 },
    { key: 'folate_mcg', name: '\u8449\u9178', unit: '\u03bcg', target: 240 },
    { key: 'calcium_mg', name: '\u30ab\u30eb\u30b7\u30a6\u30e0', unit: 'mg', target: sex === 'female' ? 650 : 750 },
    { key: 'magnesium_mg', name: '\u30de\u30b0\u30cd\u30b7\u30a6\u30e0', unit: 'mg', target: sex === 'female' ? 290 : 370 },
    { key: 'zinc_mg', name: '\u4e9c\u925b', unit: 'mg', target: sex === 'female' ? 8 : 11 },
    { key: 'omega3_mg', name: '\u30aa\u30e1\u30ac3', unit: 'mg', target: 2000 },
  ]

  const targets = [
    {
      key: 'energy_kcal',
      name: '\u30a8\u30cd\u30eb\u30ae\u30fc',
      unit: 'kcal',
      target: Number(targetKcal.toFixed(0)),
      actual: totals.kcal,
      status: statusByRule(totals.kcal, targetKcal, 'range'),
      rule: 'range',
    },
    {
      key: 'protein_g',
      name: '\u30bf\u30f3\u30d1\u30af\u8cea',
      unit: 'g',
      target: Number(proteinTarget.toFixed(1)),
      actual: totals.protein_g,
      status: statusByRule(totals.protein_g, proteinTarget, 'min'),
      rule: 'min',
    },
    {
      key: 'fat_g',
      name: '\u8102\u8cea',
      unit: 'g',
      target: Number(fatTarget.toFixed(1)),
      actual: totals.fat_g,
      status: statusByRule(totals.fat_g, fatTarget, 'max'),
      rule: 'max',
    },
    {
      key: 'carbs_g',
      name: '\u70ad\u6c34\u5316\u7269',
      unit: 'g',
      target: Number(carbsTarget.toFixed(1)),
      actual: totals.carbs_g,
      status: statusByRule(totals.carbs_g, carbsTarget, 'range'),
      rule: 'range',
    },
    ...microTargets.map((target) => {
      const actual = totals.micros[target.key] ?? null
      return {
        key: target.key,
        name: target.name,
        unit: target.unit,
        target: target.target,
        actual,
        status: statusByRule(actual, target.target, 'min'),
        rule: 'min',
      }
    }),
  ]

  return { targets }
}

async function saveReport(db: D1Database, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const reportDate = payload.report_date
  const reportType = payload.report_type
  const promptUsed = payload.prompt_used
  const content = payload.content

  if (!isValidDate(reportDate)) {
    throw new Error('report_date must be YYYY-MM-DD')
  }
  if (typeof reportType !== 'string' || !REPORT_TYPES.includes(reportType as ReportType)) {
    throw new Error('report_type must be daily | weekly | monthly')
  }
  if (typeof promptUsed !== 'string' || typeof content !== 'string') {
    throw new Error('prompt_used and content are required strings')
  }

  await execute(
    db,
    `
    INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(report_date, report_type) DO UPDATE SET
      prompt_used = excluded.prompt_used,
      content = excluded.content,
      created_at = excluded.created_at
    `,
    [reportDate, reportType, promptUsed, content, nowIso()],
  )

  const row = await queryFirst<ReportRow>(
    db,
    `
    SELECT id, report_date, report_type, prompt_used, content, created_at
    FROM ai_reports
    WHERE report_date = ? AND report_type = ?
    `,
    [reportDate, reportType],
  )
  if (!row) {
    throw new Error('saved report could not be read back')
  }
  return row
}

async function listReports(db: D1Database, reportType: string | null): Promise<Record<string, unknown>> {
  if (reportType && !REPORT_TYPES.includes(reportType as ReportType)) {
    throw new Error('report_type must be daily | weekly | monthly')
  }
  const rows = reportType
    ? await queryAll<ReportRow & { preview: string }>(
        db,
        `
        SELECT id, report_date, report_type, prompt_used, content, created_at, SUBSTR(content, 1, 200) AS preview
        FROM ai_reports
        WHERE report_type = ?
        ORDER BY report_date DESC, created_at DESC
        LIMIT 50
        `,
        [reportType],
      )
    : await queryAll<ReportRow & { preview: string }>(
        db,
        `
        SELECT id, report_date, report_type, prompt_used, content, created_at, SUBSTR(content, 1, 200) AS preview
        FROM ai_reports
        ORDER BY report_date DESC, created_at DESC
        LIMIT 50
        `,
      )

  return {
    reports: rows.map((row) => ({
      id: row.id,
      report_date: row.report_date,
      report_type: row.report_type,
      created_at: row.created_at,
      preview: row.preview,
    })),
  }
}

async function getReport(db: D1Database, reportId: number): Promise<Record<string, unknown> | null> {
  const row = await queryFirst<ReportRow>(
    db,
    `
    SELECT id, report_date, report_type, prompt_used, content, created_at
    FROM ai_reports
    WHERE id = ?
    `,
    [reportId],
  )
  return row ?? null
}

async function deleteReport(db: D1Database, reportId: number): Promise<Record<string, unknown>> {
  const result = await db.prepare('DELETE FROM ai_reports WHERE id = ?').bind(reportId).run()
  return { ok: (result.meta.changes ?? 0) > 0, deleted_id: reportId }
}

function makePrompt(type: ReportType): string {
  const date = toIsoDate(new Date())
  const title =
    type === 'daily'
      ? '\u65e5\u6b21'
      : type === 'weekly'
        ? '\u9031\u6b21'
        : '\u6708\u6b21'
  return [
    `# ${title}\u30ec\u30dd\u30fc\u30c8\u4f5c\u6210\u30d7\u30ed\u30f3\u30d7\u30c8`,
    `\u65e5\u4ed8: ${date}`,
    '\u5065\u5eb7\u6307\u6a19\u30fb\u7761\u7720\u30fb\u98df\u4e8b\u3092\u898b\u3066\u3001',
    '\u533b\u5e2b\u3001\u30c8\u30ec\u30fc\u30ca\u30fc\u3001\u7ba1\u7406\u6804\u990a\u58eb\u306e3\u8996\u70b9\u3067\u30b3\u30e1\u30f3\u30c8\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
    '\u30de\u30fc\u30ab\u30fc\u5f62\u5f0f:',
    '<!--DOCTOR-->',
    '<!--TRAINER-->',
    '<!--NUTRITIONIST-->',
    '<!--END-->',
  ].join('\n')
}

async function seedMockData(db: D1Database): Promise<Record<string, unknown>> {
  await execute(db, 'DELETE FROM sync_runs')
  await execute(db, 'DELETE FROM sync_cursor_state')
  await execute(db, 'DELETE FROM health_records')
  await execute(db, 'DELETE FROM nutrition_events')
  await execute(db, 'DELETE FROM ai_reports')
  await execute(db, 'DELETE FROM daily_metrics')
  await execute(db, 'DELETE FROM user_profiles')
  await execute(db, 'DELETE FROM record_type_counts')

  await execute(
    db,
    `
    INSERT INTO user_profiles(
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at
    )
    VALUES('default', 38, 'male', 172, 72, 420, 8000, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      age = 38,
      gender = 'male',
      height_cm = 172,
      goal_weight_kg = 72,
      sleep_goal_minutes = 420,
      steps_goal = 8000,
      updated_at = excluded.updated_at
    `,
    [nowIso()],
  )

  const today = new Date()
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const isoDate = toIsoDate(d)
    const progress = 29 - i
    const steps = 7000 + ((progress * 311) % 3600)
    const active = 280 + ((progress * 17) % 210)
    const bmr = 1670
    const total = bmr + active
    const intake = 1780 + ((progress * 29) % 240)
    const weight = Number((76 - progress * 0.04 + ((i % 3) - 1) * 0.05).toFixed(2))
    const bodyFat = Number((22 - progress * 0.03).toFixed(2))
    const sleep = Number((i === 0 ? 6.12 : 6.4 + (progress % 4) * 0.25).toFixed(2))
    const resting = 61 + (progress % 5)
    const heart = 76 + (progress % 9)
    const spo2 = Number((97 + (progress % 2) * 0.4).toFixed(1))
    const sys = 116 + (progress % 8)
    const dia = 75 + (progress % 6)
    const km = Number((steps * 0.00075).toFixed(2))

    await execute(
      db,
      `
      INSERT INTO daily_metrics(
        date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
        sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm, spo2_pct,
        blood_systolic, blood_diastolic, bmr_kcal, record_count
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [isoDate, steps, km, active, total, intake, sleep, weight, bodyFat, resting, heart, spo2, sys, dia, bmr, 12],
    )
  }

  await execute(
    db,
    'INSERT INTO record_type_counts(record_type, count) VALUES(?, ?)',
    ['DailyMetricRecord', 360],
  )

  const todayDate = toIsoDate(today)
  const protein = SUPPLEMENT_CATALOG.protein
  const vitaminD = SUPPLEMENT_CATALOG.vitamin_d
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T07:30:00.000Z`,
      todayDate,
      'protein',
      protein.label,
      1,
      protein.unit,
      protein.kcal,
      protein.protein_g,
      protein.fat_g,
      protein.carbs_g,
      JSON.stringify(protein.micros ?? {}),
      null,
    ],
  )
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T08:00:00.000Z`,
      todayDate,
      'vitamin_d',
      vitaminD.label,
      2,
      vitaminD.unit,
      vitaminD.kcal,
      vitaminD.protein_g,
      vitaminD.fat_g,
      vitaminD.carbs_g,
      JSON.stringify(vitaminD.micros ?? {}),
      null,
    ],
  )
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T12:20:00.000Z`,
      todayDate,
      null,
      '\u30c1\u30ad\u30f3\u30b5\u30e9\u30c0\u30dc\u30a6\u30eb',
      1,
      null,
      620,
      35,
      20,
      70,
      JSON.stringify({ vitamin_c_mg: 35, calcium_mg: 120 }),
      null,
    ],
  )

  const defaultContent = [
    '<!--DOCTOR-->',
    '\u7761\u7720\u306f6\u6642\u9593\u53f0\u306a\u306e\u3067\u3001\u4eca\u9031\u306f7\u6642\u9593\u76ee\u6a19\u306b\u30b7\u30d5\u30c8\u3057\u307e\u3057\u3087\u3046\u3002',
    '<!--TRAINER-->',
    '\u6b69\u6570\u306f\u5b89\u5b9a\u3057\u3066\u3044\u307e\u3059\u3002\u591c\u306b10\u5206\u3060\u3051\u8ffd\u52a0\u30a6\u30a9\u30fc\u30af\u3092\u5165\u308c\u308b\u3068\u826f\u3044\u3067\u3059\u3002',
    '<!--NUTRITIONIST-->',
    '\u30d3\u30bf\u30df\u30f3D\u3068\u305f\u3093\u3071\u304f\u8cea\u306f\u78ba\u4fdd\u3067\u304d\u3066\u3044\u307e\u3059\u3002\u91ce\u83dc\u3068\u6c34\u5206\u3092\u8db3\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002',
    '<!--END-->',
  ].join('\n')

  for (const type of REPORT_TYPES) {
    await execute(
      db,
      `
      INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
      VALUES(?, ?, ?, ?, ?)
      `,
      [todayDate, type, makePrompt(type), defaultContent, nowIso()],
    )
  }

  return {
    ok: true,
    seededDate: todayDate,
    metricDays: 30,
    reports: REPORT_TYPES.length,
  }
}

function parseSyncRequestPayload(payload: Record<string, unknown>): SyncRequestInput {
  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : ''
  const syncId = typeof payload.syncId === 'string' ? payload.syncId.trim() : ''
  const syncedAt = typeof payload.syncedAt === 'string' ? payload.syncedAt.trim() : ''
  const rangeStart = typeof payload.rangeStart === 'string' ? payload.rangeStart.trim() : ''
  const rangeEnd = typeof payload.rangeEnd === 'string' ? payload.rangeEnd.trim() : ''
  const rawRecords = payload.records
  const requiredPermissions = normalizeStringArray(payload.requiredPermissions)
  const grantedPermissions = normalizeStringArray(payload.grantedPermissions)

  if (!deviceId || !syncId || !syncedAt || !rangeStart || !rangeEnd) {
    throw new Error('deviceId, syncId, syncedAt, rangeStart, rangeEnd are required')
  }
  if (!Array.isArray(rawRecords)) {
    throw new Error('records must be an array')
  }

  const records: SyncRecordInput[] = rawRecords.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('record must be an object')
    }
    const row = item as Record<string, unknown>
    const type = typeof row.type === 'string' ? row.type.trim() : ''
    if (!type) {
      throw new Error('record.type is required')
    }
    return {
      type,
      recordId: typeof row.recordId === 'string' ? row.recordId : undefined,
      recordKey: typeof row.recordKey === 'string' ? row.recordKey : undefined,
      source: typeof row.source === 'string' ? row.source : undefined,
      startTime: typeof row.startTime === 'string' ? row.startTime : undefined,
      endTime: typeof row.endTime === 'string' ? row.endTime : undefined,
      time: typeof row.time === 'string' ? row.time : undefined,
      lastModifiedTime: typeof row.lastModifiedTime === 'string' ? row.lastModifiedTime : undefined,
      unit: typeof row.unit === 'string' ? row.unit : undefined,
      payload: row.payload ?? {},
    }
  })

  return {
    deviceId,
    syncId,
    syncedAt,
    rangeStart,
    rangeEnd,
    records,
    requiredPermissions,
    grantedPermissions,
  }
}

async function handleSync(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const payload = parseSyncRequestPayload(await readJsonBody(request))
  let upserted = 0
  let skipped = 0
  const receivedAt = nowIso()

  await execute(
    env.DB,
    `
    INSERT OR IGNORE INTO sync_runs(
      sync_id, device_id, synced_at, range_start, range_end, received_at, record_count
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.syncId,
      payload.deviceId,
      payload.syncedAt,
      payload.rangeStart,
      payload.rangeEnd,
      receivedAt,
      payload.records.length,
    ],
  )

  const requiredPermissions =
    payload.requiredPermissions && payload.requiredPermissions.length > 0
      ? payload.requiredPermissions
      : [...HEALTH_CONNECT_REQUIRED_PERMISSIONS]
  const grantedPermissions = payload.grantedPermissions ?? []
  if (requiredPermissions.length > 0 || grantedPermissions.length > 0) {
    await execute(
      env.DB,
      `
      INSERT INTO sync_permission_snapshots(
        sync_id, device_id, synced_at, received_at, required_permissions_json, granted_permissions_json
      ) VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(sync_id) DO UPDATE SET
        device_id = excluded.device_id,
        synced_at = excluded.synced_at,
        received_at = excluded.received_at,
        required_permissions_json = excluded.required_permissions_json,
        granted_permissions_json = excluded.granted_permissions_json
      `,
      [
        payload.syncId,
        payload.deviceId,
        payload.syncedAt,
        receivedAt,
        JSON.stringify(requiredPermissions),
        JSON.stringify(grantedPermissions),
      ],
    )
  }

  for (const record of payload.records) {
    try {
      const recordKey = await computeRecordKey(payload.deviceId, record)
      const source = record.source?.trim() || null
      const payloadJson = stableStringify(record.payload ?? {})
      await execute(
        env.DB,
        `
        INSERT INTO health_records(
          record_key, device_id, type, record_id, source, start_time, end_time, time,
          last_modified_time, unit, payload_json, ingested_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_key) DO UPDATE SET
          device_id = excluded.device_id,
          type = excluded.type,
          record_id = excluded.record_id,
          source = excluded.source,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          time = excluded.time,
          last_modified_time = excluded.last_modified_time,
          unit = excluded.unit,
          payload_json = excluded.payload_json,
          ingested_at = excluded.ingested_at
        `,
        [
          recordKey,
          payload.deviceId,
          record.type,
          record.recordId ?? null,
          source,
          record.startTime ?? null,
          record.endTime ?? null,
          record.time ?? null,
          record.lastModifiedTime ?? null,
          record.unit ?? null,
          payloadJson,
          receivedAt,
        ],
      )
      upserted += 1
    } catch {
      skipped += 1
    }
  }

  await execute(
    env.DB,
    'UPDATE sync_runs SET upserted_count = ?, skipped_count = ? WHERE sync_id = ?',
    [upserted, skipped, payload.syncId],
  )

  const rangeEndMs = parseIsoToMillis(payload.rangeEnd)
  if (rangeEndMs != null && !isSmokeDeviceId(payload.deviceId)) {
    const cursorRow = await queryFirst<{ last_range_end: string | null }>(
      env.DB,
      'SELECT last_range_end FROM sync_cursor_state WHERE id = 1',
    )
    const currentMs = parseIsoToMillis(cursorRow?.last_range_end ?? null) ?? 0
    if (rangeEndMs >= currentMs) {
      await execute(
        env.DB,
        `
        INSERT INTO sync_cursor_state(id, last_range_end, updated_at, last_sync_id, last_device_id)
        VALUES(1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          last_range_end = excluded.last_range_end,
          updated_at = excluded.updated_at,
          last_sync_id = excluded.last_sync_id,
          last_device_id = excluded.last_device_id
        `,
        [payload.rangeEnd, nowIso(), payload.syncId, payload.deviceId],
      )
    }
  }

  const today = toIsoDate(new Date())
  const llmApiKey = (env.LLM_API_KEY ?? '').trim()
  if (llmApiKey && ctx) {
    ctx.waitUntil(
      generateDailyReportIfNeeded(env, today).catch((err) =>
        console.error('Auto report generation failed:', err)
      ),
    )
  }

  return jsonResponse({
    accepted: true,
    upsertedCount: upserted,
    skippedCount: skipped,
  })
}

async function handleSyncCursor(url: URL, env: Env): Promise<Response> {
  const rawDeviceId = url.searchParams.get('deviceId') ?? ''
  const deviceId = rawDeviceId.trim()
  if (!deviceId) {
    return jsonResponse({ detail: 'deviceId query is required' }, 400)
  }

  const state = await queryFirst<{
    last_range_end: string | null
    updated_at: string | null
    last_sync_id: string | null
    last_device_id: string | null
  }>(
    env.DB,
    `
    SELECT last_range_end, updated_at, last_sync_id, last_device_id
    FROM sync_cursor_state
    WHERE id = 1
    `,
  )

  const fallbackByDevice = await queryFirst<{ range_end: string | null; synced_at: string | null; received_at: string | null }>(
    env.DB,
    `
    SELECT range_end, synced_at, received_at
    FROM sync_runs
    WHERE device_id = ? AND lower(device_id) NOT LIKE '%smoke%'
    ORDER BY range_end DESC, received_at DESC
    LIMIT 1
    `,
    [deviceId],
  )

  const fallbackGlobal = await queryFirst<{ range_end: string | null; synced_at: string | null; received_at: string | null }>(
    env.DB,
    `
    SELECT range_end, synced_at, received_at
    FROM sync_runs
    WHERE lower(device_id) NOT LIKE '%smoke%'
    ORDER BY range_end DESC, received_at DESC
    LIMIT 1
    `,
  )

  const rawRangeEnd = state?.last_range_end ?? fallbackByDevice?.range_end ?? fallbackGlobal?.range_end ?? null
  const parsedMs = parseIsoToMillis(rawRangeEnd)
  const clampedMs = parsedMs == null ? null : clampCursorMillisForRepair(parsedMs)
  const rangeEnd = clampedMs == null ? null : new Date(clampedMs).toISOString()
  const wasClamped = parsedMs != null && clampedMs != null && clampedMs !== parsedMs
  const source = state?.last_range_end
    ? 'cursor_state'
    : fallbackByDevice?.range_end
      ? 'sync_runs_device'
      : fallbackGlobal?.range_end
        ? 'sync_runs_global'
        : 'none'

  return jsonResponse({
    deviceId,
    source,
    found: !!rangeEnd,
    rangeEnd,
    rawRangeEnd,
    wasClamped,
    syncedAt: fallbackByDevice?.synced_at ?? fallbackGlobal?.synced_at ?? null,
    receivedAt: fallbackByDevice?.received_at ?? fallbackGlobal?.received_at ?? null,
    updatedAt: state?.updated_at ?? null,
    lastDeviceId: state?.last_device_id ?? null,
  })
}

async function handleNutritionLog(request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody(request)
  const rawItems = Array.isArray(payload.items) ? payload.items : [payload]
  const items = rawItems.filter((item): item is Record<string, unknown> => {
    return !!item && typeof item === 'object' && !Array.isArray(item)
  })

  if (items.length === 0) {
    return jsonResponse({ detail: 'No valid items' }, 400)
  }

  for (const item of items) {
    const alias = typeof item.alias === 'string' ? item.alias : null
    const label = typeof item.label === 'string' ? item.label.trim() : null
    const count = toPositiveCount(item.count, 1)
    const baseSource = alias ? SUPPLEMENT_CATALOG[alias] : null

    if (!baseSource && !label) {
      return jsonResponse({ detail: 'alias or label is required' }, 400)
    }

    const { consumedAt, localDate } = resolveDateAndTime({
      consumed_at: item.consumed_at ?? payload.consumed_at,
      local_date: item.local_date ?? payload.local_date,
    })

    const kcal = baseSource?.kcal ?? toNumberOrNull(item.kcal)
    const protein = baseSource?.protein_g ?? toNumberOrNull(item.protein_g)
    const fat = baseSource?.fat_g ?? toNumberOrNull(item.fat_g)
    const carbs = baseSource?.carbs_g ?? toNumberOrNull(item.carbs_g)
    const note = typeof item.note === 'string' ? item.note : null

    let micros: Record<string, number> = {}
    if (baseSource?.micros) {
      micros = { ...baseSource.micros }
    } else if (item.micros && typeof item.micros === 'object' && !Array.isArray(item.micros)) {
      const entries = Object.entries(item.micros).filter((entry): entry is [string, number] => {
        const [, value] = entry
        return typeof value === 'number' && Number.isFinite(value)
      })
      micros = Object.fromEntries(entries)
    }

    await execute(
      env.DB,
      `
      INSERT INTO nutrition_events(
        consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        consumedAt,
        localDate,
        alias,
        baseSource?.label ?? label,
        count,
        baseSource?.unit ?? null,
        kcal,
        protein,
        fat,
        carbs,
        JSON.stringify(micros),
        note,
      ],
    )
  }

  return jsonResponse({ ok: true, count: items.length })
}

async function handleDailyReportGet(url: URL, env: Env): Promise<Response> {
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

async function generateDailyReportIfNeeded(
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
  const [profile, scores, trendRows] = await Promise.all([
    getUserProfile(env.DB),
    getScores(env.DB, date),
    queryDailyReportTrendRows(env.DB, date),
  ])
  const season = buildSeasonContext(date)
  const prompt = buildDailyReportPrompt({
    date,
    season: { ...season },
    profile: { ...profile },
    scores: { ...scores },
    trendRows: [...trendRows],
  })

  const envProvider = (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim().toLowerCase() || DEFAULT_LLM_PROVIDER
  const provider = options.provider?.trim().toLowerCase() || envProvider
  const overrideApiKey = options.apiKey?.trim() ?? ''
  const envApiKey = (env.LLM_API_KEY ?? '').trim()
  const effectiveApiKey = overrideApiKey || envApiKey
  if (!effectiveApiKey) {
    throw new Error('LLM API key is not configured')
  }
  const overrideModel = options.model?.trim() ?? ''
  const model = overrideModel || (env.LLM_MODEL ?? '').trim() || ''

  const generated = await callLlmDailyReport(provider, effectiveApiKey, model, prompt.systemPrompt, prompt.userPrompt)
  const persistPayload: DailyReportPersistInput = {
    date,
    model: generated.model,
    prompt_tokens: generated.prompt_tokens,
    completion_tokens: generated.completion_tokens,
    generated_at: nowIso(),
    ...generated.payload,
  }

  await saveDailyReport(env.DB, persistPayload)

  return {
    date,
    generated: true,
    cached: false,
  }
}

async function handleDailyReportGenerate(request: Request, url: URL, env: Env): Promise<Response> {
  const apiKey = (env.LLM_API_KEY ?? '').trim()
  if (!apiKey) {
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

  const provider = typeof body.provider === 'string' ? body.provider : undefined
  const overrideApiKey = typeof body.api_key === 'string' ? body.api_key : undefined
  const overrideModel = typeof body.model === 'string' ? body.model : undefined

  try {
    const result = await generateDailyReportIfNeeded(env, date, {
      force,
      provider,
      apiKey: overrideApiKey ?? apiKey,
      model: overrideModel,
    })
    return jsonResponse({ ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate daily report'
    if (message.includes('JSON') || message.includes('LLM response')) {
      console.error(`daily-report-json-parse-error: ${message}`)
    }
    return jsonResponse({ detail: message }, 500)
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') {
      return optionsResponse()
    }

    if (pathname === '/healthz' && method === 'GET') {
      return jsonResponse({ ok: true })
    }

    if (pathname.startsWith('/api/') && !isAuthorized(request, env)) {
      return jsonResponse({ detail: 'Unauthorized' }, 401)
    }

    try {
      if (pathname === '/api/status' && method === 'GET') {
        const row = await queryFirst<{ total: number }>(
          env.DB,
          'SELECT COUNT(*) AS total FROM health_records',
        )
        return jsonResponse({
          ok: true,
          totalRecords: row?.total ?? 0,
          db: 'cloudflare-d1',
        })
      }

      if (pathname === '/api/summary' && method === 'GET') {
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await buildSummary(env.DB))
      }

      if (pathname === '/api/home-summary' && method === 'GET') {
        const date = url.searchParams.get('date') ?? toIsoDate(new Date())
        if (!isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await buildHomeSummary(env.DB, date))
      }

      if (pathname === '/api/scores' && method === 'GET') {
        const date = url.searchParams.get('date') ?? toIsoDate(new Date())
        if (!isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await getScores(env.DB, date))
      }

      if (pathname === '/api/report' && method === 'GET') {
        return handleDailyReportGet(url, env)
      }

      if (pathname === '/api/report/generate' && method === 'POST') {
        return handleDailyReportGenerate(request, url, env)
      }

      if (pathname === '/api/sync/cursor' && method === 'GET') {
        return handleSyncCursor(url, env)
      }

      if (pathname === '/api/sync' && method === 'POST') {
        return handleSync(request, env, ctx)
      }

      if (pathname === '/api/supplements' && method === 'GET') {
        return jsonResponse({
          supplements: Object.values(SUPPLEMENT_CATALOG).map((item) => ({
            alias: item.alias,
            label: item.label,
            kcal: item.kcal,
            protein_g: item.protein_g,
            fat_g: item.fat_g,
            carbs_g: item.carbs_g,
          })),
        })
      }

      if (pathname === '/api/nutrition/day' && method === 'GET') {
        const date = url.searchParams.get('date')
        if (!date || !isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        return jsonResponse(await getNutritionDay(env.DB, date))
      }

      if (pathname === '/api/nutrition/log' && method === 'POST') {
        const response = await handleNutritionLog(request, env)
        await rebuildAggregatesFromHealthRecords(env.DB)
        return response
      }

      if (pathname.startsWith('/api/nutrition/log/') && method === 'DELETE') {
        const idRaw = pathname.replace('/api/nutrition/log/', '')
        const id = Number.parseInt(idRaw, 10)
        if (!Number.isInteger(id)) {
          return jsonResponse({ detail: 'Invalid id' }, 400)
        }
        const result = await env.DB.prepare('DELETE FROM nutrition_events WHERE id = ?').bind(id).run()
        if ((result.meta.changes ?? 0) === 0) {
          return jsonResponse({ detail: 'Event not found' }, 404)
        }
        await rebuildAggregatesFromHealthRecords(env.DB)
        return jsonResponse({ ok: true, deleted_id: id })
      }

      if (pathname === '/api/body-data' && method === 'GET') {
        const date = url.searchParams.get('date')
        const period = parseMetricPeriod(url.searchParams.get('period'))
        if (!date || !isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        if (!period) {
          return jsonResponse({ detail: 'period query must be week | month | year' }, 400)
        }
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await getBodyData(env.DB, date, period))
      }

      if (pathname === '/api/sleep-data' && method === 'GET') {
        const date = url.searchParams.get('date')
        const period = parseMetricPeriod(url.searchParams.get('period'))
        if (!date || !isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        if (!period) {
          return jsonResponse({ detail: 'period query must be week | month | year' }, 400)
        }
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await getSleepData(env.DB, date, period))
      }

      if (pathname === '/api/vitals-data' && method === 'GET') {
        const date = url.searchParams.get('date')
        const period = parseMetricPeriod(url.searchParams.get('period'))
        if (!date || !isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        if (!period) {
          return jsonResponse({ detail: 'period query must be week | month | year' }, 400)
        }
        await ensureAggregatesUpToDate(env.DB)
        return jsonResponse(await getVitalsData(env.DB, date, period))
      }

      if (pathname === '/api/profile' && method === 'GET') {
        return jsonResponse(await getUserProfile(env.DB))
      }

      if (pathname === '/api/profile' && method === 'PUT') {
        let payload: Record<string, unknown>
        try {
          payload = await readJsonBody(request)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid request body'
          return jsonResponse({ detail: message }, 400)
        }
        try {
          return jsonResponse(await upsertUserProfile(env.DB, payload))
        } catch (error) {
          if (error instanceof ValidationError) {
            return jsonResponse({ detail: error.message }, 400)
          }
          throw error
        }
      }

      if (pathname === '/api/connection-status' && method === 'GET') {
        const lastSync = await queryFirst<{ received_at: string }>(
          env.DB,
          'SELECT received_at FROM sync_runs ORDER BY received_at DESC LIMIT 1',
        )
        const total = await queryFirst<{ c: number }>(
          env.DB,
          'SELECT COUNT(*) AS c FROM health_records',
        )
        const weight = await queryFirst<{ c: number }>(
          env.DB,
          "SELECT COUNT(*) AS c FROM health_records WHERE type='WeightRecord' LIMIT 1",
        )
        const sleep = await queryFirst<{ c: number }>(
          env.DB,
          "SELECT COUNT(*) AS c FROM health_records WHERE type='SleepSessionRecord' LIMIT 1",
        )
        const activity = await queryFirst<{ c: number }>(
          env.DB,
          "SELECT COUNT(*) AS c FROM health_records WHERE type='StepsRecord' LIMIT 1",
        )
        const vitals = await queryFirst<{ c: number }>(
          env.DB,
          "SELECT COUNT(*) AS c FROM health_records WHERE type IN ('BloodPressureRecord','RestingHeartRateRecord') LIMIT 1",
        )
        const permissions = await getHealthConnectPermissionStatus(env.DB)
        return jsonResponse({
          last_sync_at: lastSync?.received_at ?? null,
          total_records: total?.c ?? 0,
          has_weight_data: (weight?.c ?? 0) > 0,
          has_sleep_data: (sleep?.c ?? 0) > 0,
          has_activity_data: (activity?.c ?? 0) > 0,
          has_vitals_data: (vitals?.c ?? 0) > 0,
          health_connect_permissions: permissions,
        })
      }

      if (pathname === '/api/nutrients/targets' && method === 'GET') {
        const date = url.searchParams.get('date')
        if (!date || !isValidDate(date)) {
          return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
        }
        return jsonResponse(await computeTargets(env.DB, date))
      }

      if (pathname === '/api/prompt' && method === 'GET') {
        const reportType = url.searchParams.get('type') ?? 'daily'
        if (!REPORT_TYPES.includes(reportType as ReportType)) {
          return jsonResponse({ detail: 'type must be daily | weekly | monthly' }, 400)
        }
        return jsonResponse({
          type: reportType,
          prompt: makePrompt(reportType as ReportType),
        })
      }

      if (pathname === '/api/reports' && method === 'GET') {
        const reportType = url.searchParams.get('report_type')
        return jsonResponse(await listReports(env.DB, reportType))
      }

      if (pathname === '/api/reports' && method === 'POST') {
        const payload = await readJsonBody(request)
        return jsonResponse(await saveReport(env.DB, payload), 201)
      }

      if (pathname.startsWith('/api/reports/') && method === 'GET') {
        const idRaw = pathname.replace('/api/reports/', '')
        const id = Number.parseInt(idRaw, 10)
        if (!Number.isInteger(id)) {
          return jsonResponse({ detail: 'Invalid id' }, 400)
        }
        const report = await getReport(env.DB, id)
        if (!report) {
          return jsonResponse({ detail: 'Report not found' }, 404)
        }
        return jsonResponse(report)
      }

      if (pathname.startsWith('/api/reports/') && method === 'DELETE') {
        const idRaw = pathname.replace('/api/reports/', '')
        const id = Number.parseInt(idRaw, 10)
        if (!Number.isInteger(id)) {
          return jsonResponse({ detail: 'Invalid id' }, 400)
        }
        return jsonResponse(await deleteReport(env.DB, id))
      }

      if (pathname === '/api/dev/seed-mock' && method === 'POST') {
        const seedToken = (env.MOCK_SEED_TOKEN ?? '').trim()
        if (seedToken) {
          const provided = request.headers.get('X-Seed-Token') ?? request.headers.get('x-seed-token') ?? ''
          if (provided.trim() !== seedToken) {
            return jsonResponse({ detail: 'Forbidden' }, 403)
          }
        }
        return jsonResponse(await seedMockData(env.DB))
      }

      return jsonResponse({ detail: `Not found: ${method} ${pathname}` }, 404)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      return textResponse(message, 500)
    }
  },
}

export default worker
