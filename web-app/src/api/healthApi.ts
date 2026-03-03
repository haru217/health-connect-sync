import { apiFetch } from './client'
import type {
  ActivityDataResponse,
  ConnectionStatusResponse,
  DailyTabReportResponse,
  HomeSummaryResponse,
  NutrientTargetsResponse,
  NutritionDayResponse,
  ProfileResponse,
  ProfileUpdateRequest,
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
  ScoreData,
} from './types'

export async function fetchConnectionStatus(): Promise<ConnectionStatusResponse> {
  return apiFetch<ConnectionStatusResponse>('/api/connection-status')
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

export async function saveProfile(payload: ProfileUpdateRequest): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchReports(reportType: ReportType): Promise<ReportsListResponse> {
  const query = new URLSearchParams({ report_type: reportType }).toString()
  return apiFetch<ReportsListResponse>(`/api/reports?${query}`)
}

function isApiNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('API 404:')
}

export async function fetchReport(reportId: number): Promise<ReportDetailResponse>
export async function fetchReport(date: string): Promise<DailyTabReportResponse | null>
export async function fetchReport(value: number | string): Promise<ReportDetailResponse | DailyTabReportResponse | null> {
  if (typeof value === 'number') {
    return apiFetch<ReportDetailResponse>(`/api/reports/${value}`)
  }

  const query = new URLSearchParams({ date: value }).toString()
  try {
    return await apiFetch<DailyTabReportResponse>(`/api/report?${query}`)
  } catch (error) {
    if (isApiNotFoundError(error)) {
      return null
    }
    throw error
  }
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
  return apiFetch<HomeSummaryResponse>(`/api/home-summary?${query}`)
}

export async function fetchBodyData(date: string, period: string): Promise<BodyDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<BodyDataResponse>(`/api/body-data?${query}`)
}

export async function fetchSleepData(date: string, period: string): Promise<SleepDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<SleepDataResponse>(`/api/sleep-data?${query}`)
}

export async function fetchVitalsData(date: string, period: string): Promise<VitalsDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<VitalsDataResponse>(`/api/vitals-data?${query}`)
}

export async function fetchActivityData(date: string, period: string): Promise<ActivityDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<ActivityDataResponse>(`/api/activity-data?${query}`)
}

export async function fetchScores(date: string): Promise<ScoreData> {
  const query = new URLSearchParams({ date }).toString()
  return apiFetch<ScoreData>(`/api/scores?${query}`)
}
