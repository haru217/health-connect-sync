import type { Env, ExportedHandler } from './types'
import { isAuthorized, jsonResponse, optionsResponse, textResponse } from './utils'
import { handleActivityData, handleBodyData, handleSleepData, handleVitalsData } from './handlers/health'
import { handleHomeSummary } from './handlers/home-summary'
import { handleFoodAnalyze, handleFoodConfirm, handleFoodHistory, handleFoodSearch, handleFoodDelete, handleFoodUpdate } from './handlers/food'
import { handleNutritionDay, handleSupplements, handleSupplementAdd, handleSupplementDelete } from './handlers/nutrition'
import { handleNutritionLogDelete, handleNutritionLogPost } from './handlers/nutrition-log'
import { handleProfileGet, handleProfilePut } from './handlers/profile'
import { handleCustomReportGetById, handleCustomReportPost, handleCustomReportsGet, handleCustomReportTemplatesGet } from './handlers/custom-report'
import { handleGeminiUsageGet } from './handlers/gemini-usage'
import { handleDailyReportGenerate, handleDailyReportGet } from './handlers/report'
import { generateWeeklyReport, handleWeeklyReportGenerate, handleWeeklyReportGet, handleWeeklyReportsListGet } from './handlers/weekly-report'
import { generateMonthlyReport, handleMonthlyReportGenerate, handleMonthlyReportGet, handleMonthlyReportsListGet } from './handlers/monthly-report'
import { handleAiConfigGet } from './handlers/ai-config'
import {
  handleNutrientsTargets,
  handlePrompt,
  handleReportById,
  handleReportDeleteById,
  handleReportsGet,
  handleReportsPost,
  handleSeedMock,
} from './handlers/reports'
import { handleScores } from './handlers/scores'
import { handleStatus, handleConnectionStatus } from './handlers/status'
import { handleSummary } from './handlers/summary'
import { handleSync, handleSyncCursor } from './handlers/sync'
import { getLastCompletedMonth, getLastCompletedWeekStart } from './utils'

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') return optionsResponse()
    if (pathname === '/healthz' && method === 'GET') return jsonResponse({ ok: true })
    if (pathname.startsWith('/api/') && !isAuthorized(request, env)) return jsonResponse({ detail: 'Unauthorized' }, 401)

    try {
      const key = `${method} ${pathname}`
      if (key === 'GET /api/status') return handleStatus(env)
      if (key === 'GET /api/summary') return handleSummary(env)
      if (key === 'GET /api/home-summary') return handleHomeSummary(url, env)
      if (key === 'GET /api/scores') return handleScores(url, env)
      if (key === 'GET /api/report') return handleDailyReportGet(url, env)
      if (key === 'GET /api/weekly-report') return handleWeeklyReportGet(url, env)
      if (key === 'GET /api/weekly-reports') return handleWeeklyReportsListGet(url, env)
      if (key === 'GET /api/monthly-report') return handleMonthlyReportGet(url, env)
      if (key === 'GET /api/monthly-reports') return handleMonthlyReportsListGet(url, env)
      if (key === 'GET /api/gemini-usage') return handleGeminiUsageGet(env)
      if (key === 'GET /api/ai-config') return handleAiConfigGet(env)
      if (key === 'POST /api/report/generate') return handleDailyReportGenerate(request, url, env)
      if (key === 'POST /api/weekly-report/generate') return handleWeeklyReportGenerate(request, url, env, ctx)
      if (key === 'POST /api/monthly-report/generate') return handleMonthlyReportGenerate(request, url, env)
      if (key === 'POST /api/custom-report') return handleCustomReportPost(request, url, env, ctx)
      if (key === 'GET /api/custom-reports') return handleCustomReportsGet(url, env)
      if (key === 'GET /api/custom-report-templates') return handleCustomReportTemplatesGet()
      if (key === 'GET /api/sync/cursor') return handleSyncCursor(url, env)
      if (key === 'POST /api/sync') return handleSync(request, env, ctx)
      if (key === 'GET /api/supplements') return handleSupplements(env)
      if (key === 'POST /api/supplements') return handleSupplementAdd(request, env)
      if (pathname.startsWith('/api/supplements/') && method === 'DELETE') return handleSupplementDelete(pathname, env)
      if (key === 'GET /api/nutrition/day') return handleNutritionDay(url, env)
      if (key === 'POST /api/nutrition/log') return handleNutritionLogPost(request, env)
      if (key === 'POST /api/food/analyze') return handleFoodAnalyze(request, env)
      if (key === 'POST /api/food/confirm') return handleFoodConfirm(request, env)
      if (key === 'GET /api/food/search') return handleFoodSearch(url, env)
      if (key === 'GET /api/food/history') return handleFoodHistory(url, env)
      if (pathname.startsWith('/api/food/') && method === 'DELETE') return handleFoodDelete(pathname, env)
      if (pathname.startsWith('/api/food/') && method === 'PUT') return handleFoodUpdate(pathname, request, env)
      if (key === 'GET /api/body-data') return handleBodyData(url, env)
      if (key === 'GET /api/sleep-data') return handleSleepData(url, env)
      if (key === 'GET /api/vitals-data') return handleVitalsData(url, env)
      if (key === 'GET /api/activity-data') return handleActivityData(url, env)
      if (key === 'GET /api/profile') return handleProfileGet(env)
      if (key === 'PUT /api/profile') return handleProfilePut(request, env)
      if (key === 'GET /api/connection-status') return handleConnectionStatus(env)
      if (key === 'GET /api/nutrients/targets') return handleNutrientsTargets(url, env)
      if (key === 'GET /api/prompt') return handlePrompt(url)
      if (key === 'GET /api/reports') return handleReportsGet(url, env)
      if (key === 'POST /api/reports') return handleReportsPost(request, env)
      if (key === 'POST /api/dev/seed-mock') return handleSeedMock(request, env)
      if (pathname.startsWith('/api/custom-report/') && method === 'GET') {
        const id = Number.parseInt(pathname.replace('/api/custom-report/', ''), 10)
        if (Number.isFinite(id)) return handleCustomReportGetById(id, env)
      }
      if (pathname.startsWith('/api/nutrition/log/') && method === 'DELETE') return handleNutritionLogDelete(pathname, env)
      if (pathname.startsWith('/api/reports/') && method === 'GET') return handleReportById(pathname, env)
      if (pathname.startsWith('/api/reports/') && method === 'DELETE') return handleReportDeleteById(pathname, env)
      return jsonResponse({ detail: `Not found: ${method} ${pathname}` }, 404)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      return textResponse(message, 500)
    }
  },
  async scheduled(event, env, ctx): Promise<void> {
    if (event.cron === '0 0 * * 1') {
      const weekStart = getLastCompletedWeekStart()
      ctx.waitUntil(
        generateWeeklyReport(env, weekStart).catch(() => undefined),
      )
    }
    if (event.cron === '0 0 1 * *') {
      const lastMonth = getLastCompletedMonth()
      ctx.waitUntil(
        generateMonthlyReport(env, lastMonth).catch(() => undefined),
      )
    }
  },
}

export default worker
