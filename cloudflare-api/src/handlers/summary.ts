import type { D1Database, DailyMetricRow, Env } from '../types'
import { isMetaRecordType, jsonResponse, parseJsonObject, queryAll, queryFirst } from '../utils'
import { getUserProfile } from './profile'
import { ensureAggregatesUpToDate } from './sync-aggregate'
import { normalizeBmrKcal } from './sync-parsers'

export function makeDietSummary(weightSeries: Array<{ date: string; kg: number }>): Record<string, unknown> | null {
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

export async function buildSummary(db: D1Database): Promise<Record<string, unknown>> {
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


export async function handleSummary(env: Env): Promise<Response> {
  await ensureAggregatesUpToDate(env.DB)
  return jsonResponse(await buildSummary(env.DB))
}
