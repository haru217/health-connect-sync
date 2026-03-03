import { DETAILED_RETENTION_DAYS, LAST_AGGREGATED_AT_MS_KEY, MILLIS_PER_DAY, PRUNABLE_RECORD_TYPES } from '../constants'
import type { D1Database, HealthRecordRow } from '../types'
import { execute, parseIsoToMillis, parseJsonObject, queryAll, queryFirst } from '../utils'
import { addBySource, collapseDaySourceMax, dayInOffset, extractBloodPressure, extractBmrKcal, extractDistanceKm, extractEnergyKcal, extractSleepMinutes, findNumber, isoDateFromMillis, localDayFromIso, normalizeBmrKcal, setLatestValue, sleepBucketDay, toPercent } from './sync-parsers'

export async function pruneDetailedHealthRecords(db: D1Database): Promise<void> {
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

export async function rebuildAggregatesFromHealthRecords(db: D1Database): Promise<void> {
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
    const rows: HealthRecordRow[] =
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

export async function ensureAggregatesUpToDate(db: D1Database): Promise<void> {
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



