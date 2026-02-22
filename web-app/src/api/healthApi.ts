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
} from './types'

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
