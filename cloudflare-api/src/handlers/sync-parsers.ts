import { MAX_VALID_BMR_KCAL_PER_DAY, MIN_VALID_BMR_KCAL_PER_DAY } from '../constants'
import type { SyncRecordInput } from '../types'
import { parseIsoDatePart, parseIsoToMillis, parseJsonObject, toNumberOrNull } from '../utils'

export function isoDateFromMillis(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function localDayFromIso(value: string | null | undefined): string | null {
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

export function findNumber(value: unknown, keyCandidates: Set<string>, depth = 0): number | null {
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

export function toPercent(value: number | null): number | null {
  if (value == null) {
    return null
  }
  if (value >= 0 && value <= 1.2) {
    return value * 100
  }
  return value
}

export function parseZoneOffsetSeconds(value: unknown): number | null {
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

export function dayInOffset(isoValue: string | null | undefined, offsetSeconds: number): string | null {
  const ms = parseIsoToMillis(isoValue)
  if (ms == null) {
    return null
  }
  return isoDateFromMillis(ms + offsetSeconds * 1000)
}

export function sleepBucketDay(startIso: string | null, endIso: string | null, payload: Record<string, unknown>): string | null {
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

export function toStageInt(value: unknown): number | null {
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

export function mergedIntervalMinutes(intervals: Array<[number, number]>): number {
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

export function parseSleepStageIntervals(payload: Record<string, unknown>): {
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

export function extractSleepMinutes(startIso: string | null, endIso: string | null, payload: Record<string, unknown>): number {
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

export function extractSleepStageBreakdown(
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

export function extractIsoClockHHmm(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  const matched = value.match(/T(\d{2}):(\d{2})/)
  if (!matched) {
    return null
  }
  return `${matched[1] ?? '00'}:${matched[2] ?? '00'}`
}

export function parseClockMinutes(value: string | null | undefined): number | null {
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

export function formatClockMinutes(value: number): string {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function averageClockMinutes(values: number[]): number | null {
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

export function stableStringify(value: unknown): string {
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

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function computeRecordKey(_deviceId: string, record: SyncRecordInput): Promise<string> {
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

export function addBySource(map: Map<string, number>, day: string, source: string, value: number): void {
  const key = `${day}\t${source}`
  map.set(key, (map.get(key) ?? 0) + value)
}

export function collapseDaySourceMax(map: Map<string, number>): Map<string, number> {
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

export function setLatestValue(
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

export function extractDistanceKm(payload: Record<string, unknown>): number | null {
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

export function extractEnergyKcal(payload: Record<string, unknown>): number | null {
  return findNumber(payload, new Set(['inKilocalories', 'kilocalories', 'kcal', 'energy']))
}

export function extractBmrKcal(payload: Record<string, unknown>): number | null {
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

export function normalizeBmrKcal(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  if (value < MIN_VALID_BMR_KCAL_PER_DAY || value > MAX_VALID_BMR_KCAL_PER_DAY) {
    return null
  }
  return value
}

export function extractBloodPressure(payload: Record<string, unknown>): { systolic: number; diastolic: number } | null {
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

