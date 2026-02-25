import { apiFetch } from './client'
import type {
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
  HomeSummaryResponse,
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

  const sufficiency = {
    sleep: sleepHours != null && sleepHours > 0,
    steps: steps != null && steps >= 1000,
    weight: weight != null && Number.isFinite(weight),
    meal: intakeKcal != null && intakeKcal > 0,
  }

  const evidences: HomeSummaryResponse['evidences'] = []
  if (sufficiency.sleep && sleepHours != null) {
    const totalMinutes = Math.round(sleepHours * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    evidences.push({
      type: 'sleep',
      label: '睡眠',
      value: `${hours}時間${minutes}分`,
      tab: 'health',
      innerTab: 'sleep',
    })
  }
  if (sufficiency.steps && steps != null) {
    evidences.push({
      type: 'steps',
      label: '歩数',
      value: `${Math.round(steps).toLocaleString('ja-JP')}歩`,
      tab: 'exercise',
    })
  }
  if (sufficiency.weight && weight != null) {
    evidences.push({
      type: 'weight',
      label: '体重',
      value: `${weight.toFixed(1)}kg`,
      tab: 'health',
      innerTab: 'composition',
    })
  }
  if (sufficiency.meal) {
    const mealCount = intakeKcal == null ? 0 : 1
    evidences.push({
      type: 'meal',
      label: '食事',
      value: `${mealCount}件`,
      tab: 'meal',
    })
  }

  return {
    date,
    report: null,
    sufficiency,
    evidences,
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
