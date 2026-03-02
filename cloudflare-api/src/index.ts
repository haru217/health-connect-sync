interface Env {
  DB: D1Database
  API_KEY?: string
  MOCK_SEED_TOKEN?: string
}

type ReportType = 'daily' | 'weekly' | 'monthly'
type SexType = 'male' | 'female' | 'other'

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

interface ReportRow {
  id: number
  report_date: string
  report_type: ReportType
  prompt_used: string
  content: string
  created_at: string
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

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Body must be an object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON body'
    throw new Error(`Invalid request body: ${message}`)
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

  const profile = await queryFirst<Pick<ProfileRow, 'height_cm'>>(
    db,
    'SELECT height_cm FROM user_profile WHERE id = 1',
  )
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
type HomeStatusKey = 'sleep' | 'steps' | 'meal' | 'weight' | 'bp'
type HomeAttentionSeverity = 'critical' | 'warning' | 'info' | 'positive'
type HomeAttentionCategory = 'threshold' | 'trend' | 'achievement'
type HomeAttentionIcon = 'warning' | 'down' | 'up' | 'check' | 'alert'

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
    queryFirst<{ sleep_goal_minutes: number | null; steps_goal: number | null }>(
      db,
      `
      SELECT sleep_goal_minutes, steps_goal
      FROM user_profile
      WHERE id = 1
      LIMIT 1
      `,
    ),
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
      key: 'steps',
      label: '\u6b69\u6570',
      value: formatRoundedWithUnit(steps, ''),
      ok: sufficiency.steps,
      tab: 'exercise',
      tone: steps != null && steps < stepsGoal * 0.5 ? 'warning' : 'normal',
      progress: progressByTarget(steps, stepsGoal),
    },
    {
      key: 'meal',
      label: '\u98df\u4e8b',
      value: formatRoundedWithUnit(intakeKcal, 'kcal'),
      ok: sufficiency.meal,
      tab: 'meal',
      tone: 'normal',
      progress: sufficiency.meal ? 100 : 0,
    },
    {
      key: 'weight',
      label: '\u4f53\u91cd',
      value: weight == null ? null : `${weight.toFixed(1)}kg`,
      ok: sufficiency.weight,
      tab: 'health',
      innerTab: 'composition',
      tone: 'normal',
      progress: sufficiency.weight ? 100 : 0,
    },
  ]

  if (hasBp && bpSystolic != null && bpDiastolic != null) {
    statusItems.push({
      key: 'bp',
      label: 'BP',
      value: `${Math.round(bpSystolic)}/${Math.round(bpDiastolic)}`,
      ok: bpTone === 'normal',
      tab: 'health',
      innerTab: 'vital',
      tone: bpTone,
      progress: clampPercent(100 - Math.max(0, bpSystolic - 120) * 2),
    })
  }

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

async function upsertProfile(db: D1Database, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await queryFirst<ProfileRow>(db, 'SELECT * FROM user_profile WHERE id = 1')

  const nextName = typeof payload.name === 'string' ? payload.name : (current?.name ?? null)
  const nextHeight = toNumberOrNull(payload.height_cm) ?? current?.height_cm ?? null
  const nextBirthYear = toNumberOrNull(payload.birth_year) ?? current?.birth_year ?? null
  const nextGoalWeight = toNumberOrNull(payload.goal_weight_kg) ?? current?.goal_weight_kg ?? null
  const nextSleepGoal = toNumberOrNull(payload.sleep_goal_minutes) ?? current?.sleep_goal_minutes ?? 420
  const nextStepsGoal = toNumberOrNull(payload.steps_goal) ?? current?.steps_goal ?? 8000

  const sexRaw = payload.sex
  const sexCandidates: SexType[] = ['male', 'female', 'other']
  const nextSex: SexType | null = sexCandidates.includes(sexRaw as SexType)
    ? (sexRaw as SexType)
    : (current?.sex ?? null)

  await execute(
    db,
    `
    INSERT INTO user_profile(
      id, name, height_cm, birth_year, sex, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at
    )
    VALUES(1, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      height_cm = excluded.height_cm,
      birth_year = excluded.birth_year,
      sex = excluded.sex,
      goal_weight_kg = excluded.goal_weight_kg,
      sleep_goal_minutes = excluded.sleep_goal_minutes,
      steps_goal = excluded.steps_goal,
      updated_at = excluded.updated_at
    `,
    [nextName, nextHeight, nextBirthYear, nextSex, nextGoalWeight, nextSleepGoal, nextStepsGoal, nowIso()],
  )

  const updated = await queryFirst<ProfileRow>(db, 'SELECT * FROM user_profile WHERE id = 1')
  if (!updated) {
    return {}
  }
  return {
    name: updated.name ?? undefined,
    height_cm: updated.height_cm ?? undefined,
    birth_year: updated.birth_year ?? undefined,
    sex: updated.sex ?? undefined,
    goal_weight_kg: updated.goal_weight_kg ?? undefined,
    sleep_goal_minutes: updated.sleep_goal_minutes ?? 420,
    steps_goal: updated.steps_goal ?? 8000,
  }
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
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
  birthYear: number | null | undefined,
  sex: SexType | null | undefined,
): number | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null
  }

  const currentYear = new Date().getUTCFullYear()
  const safeHeight = heightCm != null && Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 172
  const safeBirthYear =
    birthYear != null && Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= currentYear
      ? birthYear
      : 1985
  const age = Math.max(15, Math.min(90, currentYear - safeBirthYear))
  const safeSex: SexType = sex === 'female' || sex === 'other' || sex === 'male' ? sex : 'male'

  const bmr =
    safeSex === 'female'
      ? 447.593 + 9.247 * weightKg + 3.098 * safeHeight - 4.33 * age
      : 88.362 + 13.397 * weightKg + 4.799 * safeHeight - 5.677 * age

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

  const profile = await queryFirst<{
    goal_weight_kg: number | null
    height_cm: number | null
    birth_year: number | null
    sex: SexType | null
  }>(db, 'SELECT goal_weight_kg, height_cm, birth_year, sex FROM user_profile WHERE id = 1')

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
          profile?.birth_year ?? null,
          profile?.sex ?? null,
        ),
    }
  })

  const currentBmr =
    normalizeBmrKcal(latestBmr?.bmr_kcal) ??
    estimateBmrKcal(
      currentWeight ?? profile?.goal_weight_kg ?? null,
      profile?.height_cm ?? null,
      profile?.birth_year ?? null,
      profile?.sex ?? null,
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

  const profile = await queryFirst<{ sleep_goal_minutes: number | null }>(
    db,
    'SELECT sleep_goal_minutes FROM user_profile WHERE id = 1',
  )
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

async function computeTargets(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const profile = await queryFirst<ProfileRow>(db, 'SELECT * FROM user_profile WHERE id = 1')
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
  const birthYear = profile?.birth_year ?? 1985
  const sex = profile?.sex ?? 'male'
  const weightKg = latestWeight?.weight_kg ?? 70
  const age = new Date().getUTCFullYear() - birthYear

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
  await execute(db, 'DELETE FROM user_profile')
  await execute(db, 'DELETE FROM record_type_counts')

  await execute(
    db,
    `
    INSERT INTO user_profile(id, name, height_cm, birth_year, sex, goal_weight_kg, updated_at)
    VALUES(1, ?, ?, ?, ?, ?, ?)
    `,
    ['user', 172, 1988, 'male', 72, nowIso()],
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

async function handleSync(request: Request, env: Env): Promise<Response> {
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

const worker: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
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

      if (pathname === '/api/sync/cursor' && method === 'GET') {
        return handleSyncCursor(url, env)
      }

      if (pathname === '/api/sync' && method === 'POST') {
        return handleSync(request, env)
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
        const row = await queryFirst<ProfileRow>(env.DB, 'SELECT * FROM user_profile WHERE id = 1')
        if (!row) {
          return jsonResponse({
            sleep_goal_minutes: 420,
            steps_goal: 8000,
          })
        }
        return jsonResponse({
          name: row.name ?? undefined,
          height_cm: row.height_cm ?? undefined,
          birth_year: row.birth_year ?? undefined,
          sex: row.sex ?? undefined,
          goal_weight_kg: row.goal_weight_kg ?? undefined,
          sleep_goal_minutes: row.sleep_goal_minutes ?? 420,
          steps_goal: row.steps_goal ?? 8000,
        })
      }

      if (pathname === '/api/profile' && method === 'PUT') {
        const payload = await readJsonBody(request)
        return jsonResponse(await upsertProfile(env.DB, payload))
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
