import { getUserProfile } from './profile'
import { isValidDate, jsonResponse, queryFirst, toIsoDate } from '../utils'
import type { D1Database, Env } from '../types'
import { ensureAggregatesUpToDate } from './sync-aggregate'

type HomeStatusTab = 'home' | 'health' | 'exercise' | 'meal' | 'my'
type HomeInnerTab = 'composition' | 'vital' | 'sleep'
type HomeStatusTone = 'normal' | 'warning' | 'critical'
type HomeStatusKey = 'sleep' | 'activity' | 'nutrition' | 'condition'
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
  tone: HomeStatusTone
  progress: number
}

interface HomeAttentionPointPayload {
  id: string
  icon: HomeAttentionIcon
  message: string
  severity: HomeAttentionSeverity
  category: HomeAttentionCategory
  navigateTo: { tab: HomeStatusTab; subTab?: HomeInnerTab }
  dataSource: string
}

export function clampPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function progressByTarget(actual: number | null | undefined, target: number): number {
  if (actual == null || !Number.isFinite(actual) || target <= 0) {
    return 0
  }
  return clampPercent((actual / target) * 100)
}

export function formatSleepLabel(sleepMinutes: number | null): string | null {
  if (sleepMinutes == null || sleepMinutes <= 0) {
    return null
  }
  const hours = Math.floor(sleepMinutes / 60)
  const minutes = sleepMinutes % 60
  return `${hours}h${String(minutes).padStart(2, '0')}m`
}

export function formatRoundedWithUnit(value: number | null, unit: string): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return `${Math.round(value).toLocaleString('ja-JP')}${unit}`
}

export async function buildHomeSummary(db: D1Database, date: string): Promise<Record<string, unknown>> {
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


export async function handleHomeSummary(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date') ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }
  await ensureAggregatesUpToDate(env.DB)
  return jsonResponse(await buildHomeSummary(env.DB, date))
}
