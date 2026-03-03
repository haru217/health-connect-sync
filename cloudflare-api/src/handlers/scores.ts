import { DEFAULT_BASELINE_SCORE, DEFAULT_BMR_KCAL } from '../constants'
import type { D1Database, DailyMetricRow, Env, UserProfileRow } from '../types'
import { average, formatSleepLabel, isValidDate, jsonResponse, queryAll, queryFirst, shiftIsoDateByDays, toIsoDate, weightedAverage } from '../utils'
import { ensureAggregatesUpToDate } from './sync-aggregate'
import { getUserProfile } from './profile'

export type ScoreColor = 'green' | 'yellow' | 'red'
type InsightType = 'positive' | 'attention' | 'threshold'
export type InsightDomain = 'sleep' | 'activity' | 'nutrition' | 'condition'

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
  scoreGap?: number
}

export function statusByRule(actual: number | null, target: number, rule: 'range' | 'min' | 'max'): 'green' | 'yellow' | 'red' {
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

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function scoreColor(score: number): ScoreColor {
  if (score >= 70) {
    return 'green'
  }
  if (score >= 50) {
    return 'yellow'
  }
  return 'red'
}

export function sleepAbsoluteScore(row: Pick<DailyMetricRow, 'sleep_hours' | 'spo2_pct'>, goalMinutes: number): number | null {
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

export function bodyAbsoluteScore(
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

export function bpAbsoluteScore(row: Pick<DailyMetricRow, 'blood_systolic' | 'blood_diastolic'>): number | null {
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

export function activityAbsoluteScore(
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

export function nutritionAbsoluteScore(row: Pick<DailyMetricRow, 'intake_kcal' | 'bmr_kcal'>): number | null {
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

export function conditionAbsoluteScore(
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

export function trendScore(currentScore: number, baselineScore: number): number {
  return clampScore(100 - Math.abs(currentScore - baselineScore) * 1.2)
}

export function hasInsightMetric(row: DailyMetricRow): boolean {
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

export function generateInsights(
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

export function sleepSummary(row: Pick<DailyMetricRow, 'sleep_hours'> | null, profile: UserProfileRow): string {
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

export function bodySummary(row: Pick<DailyMetricRow, 'weight_kg'> | null, profile: UserProfileRow): string {
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

export function bpSummary(row: Pick<DailyMetricRow, 'blood_systolic' | 'blood_diastolic'> | null): string {
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

export function activitySummary(row: Pick<DailyMetricRow, 'steps'> | null, profile: UserProfileRow): string {
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

export function nutritionSummary(row: Pick<DailyMetricRow, 'intake_kcal' | 'bmr_kcal'> | null): string {
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

export function conditionSummary(
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

export async function getScores(db: D1Database, date: string): Promise<Record<string, unknown>> {
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

  const sleepValues =
    current == null || current.sleep_hours == null || !Number.isFinite(current.sleep_hours)
      ? null
      : {
          hours: current.sleep_hours,
          label: formatSleepLabel(Math.max(0, Math.round(current.sleep_hours * 60))) ?? '0h00m',
        }
  const activityValues =
    current == null || current.steps == null || !Number.isFinite(current.steps)
      ? null
      : {
          steps: current.steps,
          label: `${Math.round(current.steps).toLocaleString('en-US')}歩`,
        }
  const nutritionValues =
    current == null || current.intake_kcal == null || !Number.isFinite(current.intake_kcal)
      ? null
      : {
          intake_kcal: current.intake_kcal,
          label: `${Math.round(current.intake_kcal).toLocaleString('en-US')}kcal`,
        }
  const conditionValues =
    current == null ||
    current.blood_systolic == null ||
    !Number.isFinite(current.blood_systolic) ||
    current.blood_diastolic == null ||
    !Number.isFinite(current.blood_diastolic)
      ? null
      : {
          systolic: current.blood_systolic,
          diastolic: current.blood_diastolic,
          label: `${Math.round(current.blood_systolic)}/${Math.round(current.blood_diastolic)}`,
        }

  const sleepDomain =
    sleepScore == null
      ? null
      : {
          score: sleepScore,
          color: scoreColor(sleepScore),
          summary: sleepSummary(current, profile),
        }
  const activityDomain =
    activityScore == null
      ? null
      : {
          score: activityScore,
          color: scoreColor(activityScore),
          summary: activitySummary(current, profile),
        }
  const nutritionDomain =
    nutritionScore == null
      ? null
      : {
          score: nutritionScore,
          color: scoreColor(nutritionScore),
          summary: nutritionSummary(current),
        }
  const conditionDomain =
    conditionScore == null
      ? null
      : {
          score: conditionScore,
          color: scoreColor(conditionScore),
          summary: conditionSummary(current, profile),
        }

  const domains = {
    sleep: sleepDomain == null ? null : { ...sleepDomain, values: sleepValues },
    activity: activityDomain == null ? null : { ...activityDomain, values: activityValues },
    nutrition: nutritionDomain == null ? null : { ...nutritionDomain, values: nutritionValues },
    condition: conditionDomain == null ? null : { ...conditionDomain, values: conditionValues },
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


export async function handleScores(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }
  await ensureAggregatesUpToDate(env.DB)
  return jsonResponse(await getScores(env.DB, date))
}
