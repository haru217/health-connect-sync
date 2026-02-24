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

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nowIso(): string {
  return new Date().toISOString()
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
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findNumber(item, keyCandidates, depth + 1)
      if (hit != null) {
        return hit
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
      const hit = findNumber(nested, keyCandidates, depth + 1)
      if (hit != null) {
        return hit
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

function extractSleepMinutes(startIso: string | null, endIso: string | null, payload: Record<string, unknown>): number {
  const startMs = parseIsoToMillis(startIso)
  const endMs = parseIsoToMillis(endIso)
  if (startMs == null || endMs == null || endMs <= startMs) {
    return 0
  }

  const stageValueSet = new Set<number>([2, 4, 5, 6])
  const detailedSet = new Set<number>([4, 5, 6])
  const stagesRaw = payload.stages
  if (!Array.isArray(stagesRaw)) {
    return (endMs - startMs) / 60000
  }

  const parsed: Array<{ stage: number; start: number; end: number }> = []
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
    if (stageInt == null || !stageValueSet.has(stageInt)) {
      continue
    }
    parsed.push({ stage: stageInt, start: st, end: et })
  }

  if (!hasValidIntervals) {
    return (endMs - startMs) / 60000
  }

  const hasDetailed = parsed.some((item) => detailedSet.has(item.stage))
  const effective = parsed
    .filter((item) => (hasDetailed ? detailedSet.has(item.stage) : stageValueSet.has(item.stage)))
    .map((item) => [item.start, item.end] as [number, number])
  if (effective.length === 0) {
    return 0
  }
  return mergedIntervalMinutes(effective)
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

async function computeRecordKey(deviceId: string, record: SyncRecordInput): Promise<string> {
  if (record.recordKey && typeof record.recordKey === 'string' && record.recordKey.trim()) {
    return record.recordKey.trim()
  }

  const source = (record.source ?? '').trim()
  if (record.recordId && record.recordId.trim()) {
    const basis = `v1|${deviceId}|${record.type}|${record.recordId.trim()}|${source}`
    return sha256Hex(basis)
  }

  const base = {
    deviceId,
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

async function rebuildAggregatesFromHealthRecords(db: D1Database): Promise<void> {
  const rows = await queryAll<HealthRecordRow>(
    db,
    `
    SELECT
      record_key, device_id, type, record_id, source, start_time, end_time, time,
      last_modified_time, unit, payload_json, ingested_at
    FROM health_records
    `,
  )

  const typeCounts = new Map<string, number>()
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

  for (const row of rows) {
    typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + 1)

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
      const kcalPerDay = extractBmrKcal(payload)
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

  await execute(db, 'DELETE FROM daily_metrics')
  await execute(db, 'DELETE FROM record_type_counts')

  for (const [recordType, count] of typeCounts.entries()) {
    await execute(
      db,
      'INSERT INTO record_type_counts(record_type, count) VALUES(?, ?)',
      [recordType, count],
    )
  }
  await execute(
    db,
    'INSERT INTO record_type_counts(record_type, count) VALUES(?, ?)',
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
    if (row.bmr_kcal != null) {
      basalMetabolicRateKcalByDate.push({
        date: row.date,
        kcalPerDay: row.bmr_kcal,
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
    exerciseSessions: [],
    diet,
    insights,
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

  const sexRaw = payload.sex
  const sexCandidates: SexType[] = ['male', 'female', 'other']
  const nextSex: SexType | null = sexCandidates.includes(sexRaw as SexType)
    ? (sexRaw as SexType)
    : (current?.sex ?? null)

  await execute(
    db,
    `
    INSERT INTO user_profile(id, name, height_cm, birth_year, sex, goal_weight_kg, updated_at)
    VALUES(1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      height_cm = excluded.height_cm,
      birth_year = excluded.birth_year,
      sex = excluded.sex,
      goal_weight_kg = excluded.goal_weight_kg,
      updated_at = excluded.updated_at
    `,
    [nextName, nextHeight, nextBirthYear, nextSex, nextGoalWeight, nowIso()],
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
  }
}

async function handleSync(request: Request, env: Env): Promise<Response> {
  const payload = parseSyncRequestPayload(await readJsonBody(request))
  let upserted = 0
  let skipped = 0

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
      nowIso(),
      payload.records.length,
    ],
  )

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
          nowIso(),
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

  return jsonResponse({
    accepted: true,
    upsertedCount: upserted,
    skippedCount: skipped,
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

      if (pathname === '/api/profile' && method === 'GET') {
        const row = await queryFirst<ProfileRow>(env.DB, 'SELECT * FROM user_profile WHERE id = 1')
        if (!row) {
          return jsonResponse({})
        }
        return jsonResponse({
          name: row.name ?? undefined,
          height_cm: row.height_cm ?? undefined,
          birth_year: row.birth_year ?? undefined,
          sex: row.sex ?? undefined,
          goal_weight_kg: row.goal_weight_kg ?? undefined,
        })
      }

      if (pathname === '/api/profile' && method === 'PUT') {
        const payload = await readJsonBody(request)
        return jsonResponse(await upsertProfile(env.DB, payload))
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
