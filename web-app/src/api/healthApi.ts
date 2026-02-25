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
      tone: 'normal',
    },
    {
      key: 'steps',
      label: '歩数',
      value: stepsValue,
      ok: sufficiency.steps,
      tab: 'exercise',
      tone: 'normal',
    },
    {
      key: 'meal',
      label: '食事',
      value: mealValue,
      ok: sufficiency.meal,
      tab: 'meal',
      tone: 'normal',
    },
    {
      key: 'weight',
      label: '体重',
      value: weightValue,
      ok: sufficiency.weight,
      tab: 'health',
      innerTab: 'composition',
      tone: 'normal',
    },
  ]

  if (bp != null) {
    statusItems.push({
      key: 'bp',
      label: 'BP',
      value: bloodPressureValue,
      ok: true,
      tab: 'health',
      innerTab: 'vital',
      tone: bp.systolic >= 130 || bp.diastolic >= 85 ? 'warning' : 'normal',
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
