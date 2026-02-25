import { apiFetch } from './client'
import type {
  HomeSummaryResponse,
  NutrientTargetsResponse,
  NutritionDayResponse,
  ProfileResponse,
  PromptResponse,
  ReportDetailResponse,
  ReportType,
  ReportsListResponse,
  SaveReportRequest,
  SummaryResponse,
  SupplementsResponse,
  BodyDataResponse,
  SleepDataResponse,
  VitalsDataResponse,
} from './types'

function valueOnDate<T extends { date: string }>(
  items: T[] | undefined,
  date: string,
): T | null {
  if (!items || items.length === 0) {
    return null
  }
  return items.find((item) => item.date === date) ?? null
}

function latestOnOrBeforeDate<T extends { date: string }>(
  items: T[] | undefined,
  date: string,
): T | null {
  if (!items || items.length === 0) {
    return null
  }
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    if (item.date <= date) {
      return item
    }
  }
  return null
}

function toHomeSummaryFromSummary(summary: SummaryResponse, date: string): HomeSummaryResponse {
  const steps = valueOnDate(summary.stepsByDate, date)?.steps ?? null
  const sleepHours = valueOnDate(summary.sleepHoursByDate, date)?.hours ?? null
  const intakeKcal = valueOnDate(summary.intakeCaloriesByDate, date)?.kcal ?? null
  const weight = latestOnOrBeforeDate(summary.weightByDate, date)?.kg ?? null
  const bp = latestOnOrBeforeDate(summary.bloodPressureByDate, date) ?? null

  const totalSleepMinutes = sleepHours == null ? null : Math.round(sleepHours * 60)
  const sleepValue =
    totalSleepMinutes == null
      ? null
      : `${Math.floor(totalSleepMinutes / 60)}h${String(totalSleepMinutes % 60).padStart(2, '0')}m`
  const stepsValue = steps == null ? null : `${Math.round(steps).toLocaleString('ja-JP')}`
  const weightValue = weight == null ? null : `${weight.toFixed(1)}kg`
  const mealValue = intakeKcal == null ? null : `${Math.round(intakeKcal).toLocaleString('ja-JP')}kcal`
  const bloodPressureValue = bp == null ? null : `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}`

  const sufficiency = {
    sleep: sleepHours != null && sleepHours > 0,
    steps: steps != null && steps >= 1000,
    weight: weight != null && Number.isFinite(weight),
    meal: intakeKcal != null && intakeKcal > 0,
    bp: bp != null,
  }

  const statusItems: NonNullable<HomeSummaryResponse['statusItems']> = [
    {
      key: 'sleep',
      label: '睡眠',
      value: sleepValue,
      ok: sufficiency.sleep,
      tab: 'health',
      innerTab: 'sleep',
      tone: totalSleepMinutes && totalSleepMinutes < 300 ? 'warning' : 'normal',
      progress: 58,
    },
    {
      key: 'steps',
      label: '歩数',
      value: stepsValue,
      ok: sufficiency.steps,
      tab: 'exercise',
      tone: 'normal',
      progress: 34,
    },
    {
      key: 'meal',
      label: '食事',
      value: mealValue,
      ok: sufficiency.meal,
      tab: 'meal',
      tone: 'normal',
      progress: 0,
    },
    {
      key: 'weight',
      label: '体重',
      value: weightValue,
      ok: sufficiency.weight,
      tab: 'health',
      innerTab: 'composition',
      tone: 'normal',
      progress: 100,
    },
  ]

  if (bp != null) {
    let bpTone: 'normal' | 'warning' | 'critical' = 'normal'
    if (bp.systolic >= 140 || bp.diastolic >= 90) bpTone = 'critical'
    else if (bp.systolic >= 130 || bp.diastolic >= 85) bpTone = 'warning'

    statusItems.push({
      key: 'bp',
      label: '血圧',
      value: bloodPressureValue,
      ok: bpTone === 'normal',
      tab: 'health',
      innerTab: 'vital',
      tone: bpTone,
      progress: Math.max(0, 100 - (bp.systolic - 120)),
    })
  }

  return {
    date,
    report: null,
    sufficiency,
    evidences: [],
    statusItems,
    attentionPoints: [],
    previousReport: null,
  }
}

export async function fetchSummary(): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>('/api/summary')
}

export async function fetchNutritionDay(date: string): Promise<NutritionDayResponse> {
  const query = new URLSearchParams({ date }).toString()
  return apiFetch<NutritionDayResponse>(`/api/nutrition/day?${query}`)
}

export async function logNutrition(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/nutrition/log', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteNutritionLog(eventId: number): Promise<{ ok: boolean; deleted_id: number }> {
  return apiFetch<{ ok: boolean; deleted_id: number }>(`/api/nutrition/log/${eventId}`, {
    method: 'DELETE',
  })
}

export async function fetchSupplements(): Promise<SupplementsResponse> {
  return apiFetch<SupplementsResponse>('/api/supplements')
}

export async function fetchNutrientTargets(date: string): Promise<NutrientTargetsResponse> {
  const query = new URLSearchParams({ date }).toString()
  return apiFetch<NutrientTargetsResponse>(`/api/nutrients/targets?${query}`)
}

export async function fetchProfile(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/api/profile')
}

export async function fetchReports(reportType: ReportType): Promise<ReportsListResponse> {
  const query = new URLSearchParams({ report_type: reportType }).toString()
  return apiFetch<ReportsListResponse>(`/api/reports?${query}`)
}

export async function fetchReport(reportId: number): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`/api/reports/${reportId}`)
}

export async function saveReport(payload: SaveReportRequest): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchPrompt(reportType: ReportType): Promise<PromptResponse> {
  const query = new URLSearchParams({ type: reportType }).toString()
  return apiFetch<PromptResponse>(`/api/prompt?${query}`)
}

export async function fetchHomeSummary(date: string): Promise<HomeSummaryResponse> {
  const query = new URLSearchParams({ date }).toString()
  try {
    return await apiFetch<HomeSummaryResponse>(`/api/home-summary?${query}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Backward-compatible fallback when backend has not implemented /api/home-summary yet.
    if (!message.startsWith('API 404:')) {
      throw error
    }
    const summary = await fetchSummary()
    return toHomeSummaryFromSummary(summary, date)
  }
}

export async function fetchBodyData(date: string, period: string): Promise<BodyDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  try {
    return await apiFetch<BodyDataResponse>(`/api/body-data?${query}`)
  } catch (e) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const series = Array.from({ length: days }).map((_, i) => {
      const d = new Date(date);
      if (period === 'year') d.setMonth(d.getMonth() - (11 - i));
      else d.setDate(d.getDate() - (days - 1 - i));
      const ds = d.toISOString().split('T')[0];
      return {
        date: period === 'year' ? ds.slice(0, 7) : ds,
        weight_kg: 82 + Math.sin(i) * 2 + (i * -0.1),
        body_fat_pct: 22 + Math.cos(i) * 1 + (i * -0.05),
        bmr_kcal: 1680
      }
    });
    return {
      baseDate: date, period: period as 'week' | 'month' | 'year',
      current: { weight_kg: 81.5, body_fat_pct: 21.5, bmi: 24.5, bmr_kcal: 1680 },
      goalWeight: 72.0,
      series,
      periodSummary: {
        avg_weight_kg: 81.9,
        avg_body_fat_pct: 21.9,
        avg_bmi: 24.6,
        points: series.length,
      },
    }
  }
}

export async function fetchSleepData(date: string, period: string): Promise<SleepDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  try {
    return await apiFetch<SleepDataResponse>(`/api/sleep-data?${query}`)
  } catch (e) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const series = Array.from({ length: days }).map((_, i) => {
      const d = new Date(date);
      if (period === 'year') d.setMonth(d.getMonth() - (11 - i));
      else d.setDate(d.getDate() - (days - 1 - i));
      const ds = d.toISOString().split('T')[0];
      const total = 360 + Math.random() * 120;
      return {
        date: period === 'year' ? ds.slice(0, 7) : ds,
        sleep_minutes: total,
        deep_min: total * 0.2, light_min: total * 0.5, rem_min: total * 0.3
      }
    });
    return {
      baseDate: date, period: period as 'week' | 'month' | 'year',
      current: { sleep_minutes: 410, bedtime: '23:30', wake_time: '06:20', avg_spo2: 97, min_spo2: 92 },
      stages: { deep_min: 82, light_min: 205, rem_min: 123 },
      series,
      periodSummary: { avg_sleep_min: 405, goal_days: 5, avg_spo2: 96.8, min_spo2: 91.7 }
    }
  }
}

export async function fetchVitalsData(date: string, period: string): Promise<VitalsDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  try {
    return await apiFetch<VitalsDataResponse>(`/api/vitals-data?${query}`)
  } catch (e) {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const series = Array.from({ length: days }).map((_, i) => {
      const d = new Date(date);
      if (period === 'year') d.setMonth(d.getMonth() - (11 - i));
      else d.setDate(d.getDate() - (days - 1 - i));
      const ds = d.toISOString().split('T')[0];
      return {
        date: period === 'year' ? ds.slice(0, 7) : ds,
        systolic: 115 + Math.random() * 15,
        diastolic: 75 + Math.random() * 10,
        resting_hr: 60 + Math.random() * 10
      }
    });
    return {
      baseDate: date, period: period as 'week' | 'month' | 'year',
      current: { systolic: 122, diastolic: 82, resting_hr: 62 },
      series,
      periodSummary: {
        avg_systolic: 124,
        avg_diastolic: 81,
        avg_resting_hr: 63,
        high_bp_points: 2,
      },
    }
  }
}
