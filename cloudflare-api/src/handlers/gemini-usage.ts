import { GEMINI_COST_PER_COMPLETION_TOKEN_JPY, GEMINI_COST_PER_PROMPT_TOKEN_JPY, GEMINI_MONTHLY_LIMIT_JPY } from '../constants'
import type { D1Database, Env } from '../types'
import { execute, jsonResponse, queryFirst } from '../utils'

interface GeminiUsageMonthlyRow {
  month: string
  total_calls: number
  total_prompt_tokens: number
  total_completion_tokens: number
  estimated_cost_jpy: number
}

interface GeminiMonthlyUsage {
  month: string
  totalCalls: number
  totalPromptTokens: number
  totalCompletionTokens: number
  estimatedCostJpy: number
}

function resolveCurrentMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 7)
}

function toSafeTokenCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  return Math.round(value)
}

export async function getMonthlyUsage(db: D1Database, month: string): Promise<GeminiMonthlyUsage> {
  const row = await queryFirst<GeminiUsageMonthlyRow>(
    db,
    `
    SELECT
      month,
      total_calls,
      total_prompt_tokens,
      total_completion_tokens,
      estimated_cost_jpy
    FROM gemini_usage_monthly
    WHERE month = ?
    LIMIT 1
    `,
    [month],
  )

  return {
    month,
    totalCalls: row?.total_calls ?? 0,
    totalPromptTokens: row?.total_prompt_tokens ?? 0,
    totalCompletionTokens: row?.total_completion_tokens ?? 0,
    estimatedCostJpy: row?.estimated_cost_jpy ?? 0,
  }
}

export async function checkMonthlyLimit(db: D1Database): Promise<{
  ok: boolean
  currentCostJpy: number
  limitJpy: number
}> {
  const month = resolveCurrentMonth()
  const usage = await getMonthlyUsage(db, month)
  return {
    ok: usage.estimatedCostJpy < GEMINI_MONTHLY_LIMIT_JPY,
    currentCostJpy: usage.estimatedCostJpy,
    limitJpy: GEMINI_MONTHLY_LIMIT_JPY,
  }
}

export async function recordGeminiUsage(
  db: D1Database,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  const month = resolveCurrentMonth()
  const safePromptTokens = toSafeTokenCount(promptTokens)
  const safeCompletionTokens = toSafeTokenCount(completionTokens)
  const estimatedCostJpy =
    safePromptTokens * GEMINI_COST_PER_PROMPT_TOKEN_JPY +
    safeCompletionTokens * GEMINI_COST_PER_COMPLETION_TOKEN_JPY

  await execute(
    db,
    `
    INSERT INTO gemini_usage_monthly(
      month,
      total_calls,
      total_prompt_tokens,
      total_completion_tokens,
      estimated_cost_jpy,
      updated_at
    ) VALUES(?, 1, ?, ?, ?, datetime('now'))
    ON CONFLICT(month) DO UPDATE SET
      total_calls = gemini_usage_monthly.total_calls + 1,
      total_prompt_tokens = gemini_usage_monthly.total_prompt_tokens + excluded.total_prompt_tokens,
      total_completion_tokens = gemini_usage_monthly.total_completion_tokens + excluded.total_completion_tokens,
      estimated_cost_jpy = gemini_usage_monthly.estimated_cost_jpy + excluded.estimated_cost_jpy,
      updated_at = datetime('now')
    `,
    [month, safePromptTokens, safeCompletionTokens, estimatedCostJpy],
  )
}

export async function handleGeminiUsageGet(env: Env): Promise<Response> {
  const month = resolveCurrentMonth()
  const usage = await getMonthlyUsage(env.DB, month)
  return jsonResponse({
    month: usage.month,
    total_calls: usage.totalCalls,
    total_prompt_tokens: usage.totalPromptTokens,
    total_completion_tokens: usage.totalCompletionTokens,
    estimated_cost_jpy: usage.estimatedCostJpy,
    limit_jpy: GEMINI_MONTHLY_LIMIT_JPY,
  })
}
