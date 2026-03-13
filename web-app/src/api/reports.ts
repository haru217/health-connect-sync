import { apiFetch } from './client'
import type { CustomReportHistoryItem, WeeklyReportItem } from './types'

interface CustomReportListRow {
    id: number
    template_id: string
    template_label: string
    report: string | null
    status: string
    created_at: string
}

export async function fetchCustomReportsHistory(): Promise<CustomReportHistoryItem[]> {
    try {
        const res = await apiFetch<{ reports: CustomReportListRow[] }>('/api/custom-reports')
        return (res.reports || [])
            .filter((r) => r.status === 'done' && r.report)
            .map((r) => ({
                id: r.id,
                date: r.created_at,
                templateLabel: r.template_label,
                excerpt: (r.report ?? '').slice(0, 200),
                createdAt: r.created_at,
            }))
    } catch {
        return []
    }
}

interface WeeklyReportListResponse {
    reports: WeeklyReportItem[]
}

export async function fetchCustomReportById(id: number): Promise<string> {
    const res = await apiFetch<{ report: string }>(`/api/custom-report/${id}`)
    return res.report
}

export async function fetchWeeklyReports(limit = 10, offset = 0): Promise<WeeklyReportItem[]> {
    try {
        const query = new URLSearchParams({
            limit: String(limit),
            offset: String(offset),
        }).toString()
        const res = await apiFetch<WeeklyReportListResponse>(`/api/weekly-reports?${query}`)
        return res.reports ?? []
    } catch {
        return []
    }
}

export async function fetchWeeklyReportByWeekStart(weekStart: string): Promise<WeeklyReportItem> {
    const query = new URLSearchParams({ week_start: weekStart }).toString()
    return apiFetch<WeeklyReportItem>(`/api/weekly-report?${query}`)
}

export async function requestWeeklyReportGenerate(weekStart?: string): Promise<{ week_start: string; accepted: boolean; force?: boolean }> {
    const body = weekStart ? { week_start: weekStart } : {}
    return apiFetch<{ week_start: string; accepted: boolean; force?: boolean }>('/api/weekly-report/generate', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

interface CustomReportJobResponse {
    id: number
    template_id: string
    template_label: string
    report: string | null
    status: 'pending' | 'done' | 'error'
    created_at: string
}

export async function requestCustomReport(templateId: string): Promise<CustomReportHistoryItem> {
    const job = await apiFetch<CustomReportJobResponse>('/api/custom-report', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId }),
    })

    // Poll until done (max 60s)
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const result = await apiFetch<CustomReportJobResponse>(`/api/custom-report/${job.id}`)
        if (result.status === 'done' && result.report) {
            return {
                id: result.id,
                date: result.created_at,
                templateLabel: result.template_label,
                excerpt: result.report.slice(0, 100),
                createdAt: result.created_at,
            }
        }
        if (result.status === 'error') {
            throw new Error('レポート生成に失敗しました')
        }
    }
    throw new Error('レポート生成がタイムアウトしました')
}
