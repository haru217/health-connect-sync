import { DEFAULT_BMR_KCAL, HEALTH_CONNECT_REQUIRED_PERMISSIONS, RECORD_PERMISSION_MAP } from '../constants'
import type { D1Database, DailyMetricRow, Env, MetricPeriod, SexType } from '../types'
import { average, isValidDate, jsonResponse, normalizeStringArray, parseJsonObject, parseIsoToDate, parseIsoToMillis, parseMetricPeriod, queryAll, queryFirst, shiftIsoDateByDays, shiftYearMonth, toYearMonth } from '../utils'
import { ensureAggregatesUpToDate } from './sync-aggregate'
import { averageClockMinutes, dayInOffset, extractIsoClockHHmm, extractSleepMinutes, extractSleepStageBreakdown, formatClockMinutes, localDayFromIso, mergedIntervalMinutes, normalizeBmrKcal, parseClockMinutes, sleepBucketDay, toPercent } from './sync-parsers'
import { getUserProfile } from './profile'


export type { MetricPeriod } from '../types'

export function minimum(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (valid.length === 0) {
    return null
  }
  return Math.min(...valid)
}

export function estimateBmrKcal(
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

export function roundOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return Math.round(value)
}

export function normalizeBodyFatPct(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export function metricLabels(baseDate: string, period: MetricPeriod): string[] {
  if (period === 'year') {
    const baseYm = toYearMonth(baseDate)
    const startYm = shiftYearMonth(baseYm, -11)
    return Array.from({ length: 12 }, (_, index) => shiftYearMonth(startYm, index))
  }

  const days = period === 'week' ? 7 : 30
  const startDate = shiftIsoDateByDays(baseDate, -(days - 1))
  return Array.from({ length: days }, (_, index) => shiftIsoDateByDays(startDate, index))
}

export function latestDateOf<T extends { date: string }>(items: T[], predicate: (item: T) => boolean): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    if (predicate(item)) {
      return item.date
    }
  }
  return null
}

export async function getBodyData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
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

interface SleepRecordDailyStatsAccumulator extends SleepRecordDailyStats {
  intervals: Array<[number, number]>
}

export async function collectSleepRecordStatsByDay(
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

  const byDay = new Map<string, SleepRecordDailyStatsAccumulator>()
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

    const startMs = parseIsoToMillis(row.start_time)
    const endMs = parseIsoToMillis(row.end_time) ?? startMs ?? 0
    const sleepInterval =
      startMs != null && endMs > startMs
        ? ([startMs, endMs] as [number, number])
        : null
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
        intervals: sleepInterval == null ? [] : [sleepInterval],
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
    if (sleepInterval != null) {
      existing.intervals.push(sleepInterval)
    }
  }

  const finalizedByDay = new Map<string, SleepRecordDailyStats>()
  for (const [day, stats] of byDay.entries()) {
    finalizedByDay.set(day, {
      sleep_minutes: stats.intervals.length > 0 ? mergedIntervalMinutes(stats.intervals) : stats.sleep_minutes,
      deep_min: stats.deep_min,
      light_min: stats.light_min,
      rem_min: stats.rem_min,
      bedtime: stats.bedtime,
      wake_time: stats.wake_time,
      latest_end_ms: stats.latest_end_ms,
    })
  }

  const avgBedtimeMin = averageClockMinutes(bedtimeMinutes)
  const avgWakeMin = averageClockMinutes(wakeMinutes)
  return {
    by_day: finalizedByDay,
    avg_bedtime: avgBedtimeMin == null ? null : formatClockMinutes(avgBedtimeMin),
    avg_wake_time: avgWakeMin == null ? null : formatClockMinutes(avgWakeMin),
  }
}

export async function getSleepData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
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

export async function getVitalsData(db: D1Database, baseDate: string, period: MetricPeriod): Promise<Record<string, unknown>> {
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

export function parsePermissionsJson(value: string | null | undefined): string[] {
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

export async function getHealthConnectPermissionStatus(db: D1Database): Promise<Record<string, unknown>> {
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


export async function handleBodyData(url: URL, env: Env): Promise<Response> {
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

export async function handleSleepData(url: URL, env: Env): Promise<Response> {
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

export async function handleVitalsData(url: URL, env: Env): Promise<Response> {
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
