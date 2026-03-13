import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER } from '../constants'
import { REPORT_TEMPLATE_MAP, REPORT_TEMPLATES, type ReportTemplateId } from '../constants/custom-report-templates'
import type { Env, ExecutionContext } from '../types'
import { execute, isValidDate, jsonResponse, nowIso, queryAll, queryFirst, toIsoDate } from '../utils'
import {
  buildHaruSystemPrompt,
  buildHaruUserPrompt,
  callLlmPlainText,
  loadHaruPromptContext,
  readOptionalJsonBody,
} from './report'

interface CustomReportRow {
  id: number
  template_id: string
  report: string | null
  status: string
  created_at: string
}

function toTemplateIdOrNull(value: string): ReportTemplateId | null {
  for (const template of REPORT_TEMPLATES) {
    if (template.id === value) {
      return template.id
    }
  }
  return null
}

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(1, parsed))
}

function parseOffset(value: string | null): number {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function normalizeCreatedAt(value: string): string {
  if (!value) return value
  if (value.includes('T')) return value
  return `${value.replace(' ', 'T')}Z`
}

function toReportResponse(row: CustomReportRow) {
  const templateId = toTemplateIdOrNull(row.template_id)
  const template = templateId ? REPORT_TEMPLATE_MAP.get(templateId) : null
  return {
    id: row.id,
    template_id: row.template_id,
    template_label: template?.label ?? row.template_id,
    report: row.report,
    status: row.status,
    created_at: normalizeCreatedAt(row.created_at),
  }
}

export async function handleCustomReportTemplatesGet(): Promise<Response> {
  return jsonResponse({
    templates: REPORT_TEMPLATES.map((template) => ({
      id: template.id,
      label: template.label,
    })),
  })
}

export async function handleCustomReportsGet(url: URL, env: Env): Promise<Response> {
  const limit = parseLimit(url.searchParams.get('limit'), 20)
  const offset = parseOffset(url.searchParams.get('offset'))

  const rows = await queryAll<CustomReportRow>(
    env.DB,
    `
    SELECT id, template_id, report, status, created_at
    FROM custom_reports
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ? OFFSET ?
    `,
    [limit, offset],
  )

  return jsonResponse({
    reports: rows.map(toReportResponse),
  })
}

export async function handleCustomReportGetById(id: number, env: Env): Promise<Response> {
  const row = await queryFirst<CustomReportRow>(
    env.DB,
    `SELECT id, template_id, report, status, created_at FROM custom_reports WHERE id = ? LIMIT 1`,
    [id],
  )
  if (!row) {
    return jsonResponse({ detail: 'Report not found' }, 404)
  }
  return jsonResponse(toReportResponse(row))
}

export async function handleCustomReportPost(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await readOptionalJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  const templateIdValue = typeof body.template_id === 'string' ? body.template_id.trim() : ''
  const templateId = toTemplateIdOrNull(templateIdValue)
  if (!templateId) {
    return jsonResponse({ detail: 'template_id is invalid' }, 400)
  }
  const template = REPORT_TEMPLATE_MAP.get(templateId)
  if (!template) {
    return jsonResponse({ detail: 'template_id is invalid' }, 400)
  }

  const bodyDate = typeof body.date === 'string' ? body.date : null
  const queryDate = url.searchParams.get('date')
  const date = bodyDate ?? queryDate ?? toIsoDate(new Date())
  if (!isValidDate(date)) {
    return jsonResponse({ detail: 'date must be YYYY-MM-DD' }, 400)
  }

  const envLlmApiKey = (env.LLM_API_KEY ?? '').trim()
  const geminiApiKey = (env.GEMINI_API_KEY ?? '').trim()
  const overrideApiKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''
  const overrideProvider = typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : ''

  let provider: string
  let effectiveApiKey: string
  if (overrideApiKey) {
    effectiveApiKey = overrideApiKey
    provider = overrideProvider || (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim().toLowerCase() || DEFAULT_LLM_PROVIDER
  } else if (envLlmApiKey) {
    effectiveApiKey = envLlmApiKey
    provider = overrideProvider || (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim().toLowerCase() || DEFAULT_LLM_PROVIDER
  } else if (geminiApiKey) {
    effectiveApiKey = geminiApiKey
    provider = 'gemini'
  } else {
    return jsonResponse({ detail: 'LLM API key is not configured' }, 503)
  }
  const overrideModel = typeof body.model === 'string' ? body.model.trim() : ''
  const model = overrideModel || (env.LLM_MODEL ?? '').trim() || ''

  // Insert pending row immediately
  const createdAt = nowIso()
  await execute(
    env.DB,
    `INSERT INTO custom_reports(template_id, report, status, created_at) VALUES(?, '', 'pending', ?)`,
    [template.id, createdAt],
  )
  const inserted = await queryFirst<{ id: number }>(
    env.DB,
    `SELECT id FROM custom_reports ORDER BY id DESC LIMIT 1`,
  )
  if (!inserted) {
    return jsonResponse({ detail: 'Failed to create report job' }, 500)
  }
  const reportId = inserted.id

  // Generate in background via waitUntil (bypasses CPU time limit)
  ctx.waitUntil(
    generateCustomReportAsync(env, reportId, template, date, provider, effectiveApiKey, model).catch(
      (err) => console.error(`custom-report-bg-error id=${reportId}: ${err instanceof Error ? err.message : err}`),
    ),
  )

  return jsonResponse(
    {
      id: reportId,
      template_id: template.id,
      template_label: template.label,
      report: null,
      status: 'pending',
      created_at: createdAt,
    },
    202,
  )
}

async function generateCustomReportAsync(
  env: Env,
  reportId: number,
  template: { id: string; prompt: string },
  date: string,
  provider: string,
  apiKey: string,
  model: string,
): Promise<void> {
  try {
    const promptContext = await loadHaruPromptContext(env.DB, date)
    const systemPrompt = buildHaruSystemPrompt({
      minChars: 300,
      maxChars: 2000,
      templatePrompt: template.prompt,
    })
    const userPrompt = buildHaruUserPrompt({
      date,
      trendRows: promptContext.trendRows,
      nutritionEvents: promptContext.nutritionEvents,
      templatePrompt: template.prompt,
      scores: promptContext.scores,
    })

    const generated = await callLlmPlainText(provider, apiKey, model, systemPrompt, userPrompt, {
      minChars: 300,
      maxChars: 2000,
      forbidToday: false,
    })

    await execute(
      env.DB,
      `UPDATE custom_reports SET report = ?, status = 'done' WHERE id = ?`,
      [generated.text, reportId],
    )
  } catch (error) {
    const errMsg = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
    await execute(
      env.DB,
      `UPDATE custom_reports SET status = 'error', report = ? WHERE id = ?`,
      [errMsg, reportId],
    ).catch(() => {})
  }
}
