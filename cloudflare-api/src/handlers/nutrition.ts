import type { D1Database, Env, NutritionEventRow } from '../types'
import { isValidDate, jsonResponse, parseMicros, queryAll, toIsoDate, toNullableSum } from '../utils'
import { SUPPLEMENT_CATALOG } from '../constants'

export function resolveDateAndTime(input: Record<string, unknown>): { consumedAt: string; localDate: string } {
  const consumedAtRaw = typeof input.consumed_at === 'string' ? input.consumed_at : null
  if (consumedAtRaw) {
    const parsed = new Date(consumedAtRaw)
    if (!Number.isNaN(parsed.getTime())) {
      return {
        consumedAt: parsed.toISOString(),
        localDate: toIsoDate(parsed),
      }
    }
  }

  const localDateRaw = typeof input.local_date === 'string' ? input.local_date : null
  if (localDateRaw && isValidDate(localDateRaw)) {
    return {
      consumedAt: `${localDateRaw}T12:00:00.000Z`,
      localDate: localDateRaw,
    }
  }

  const now = new Date()
  return {
    consumedAt: now.toISOString(),
    localDate: toIsoDate(now),
  }
}

export async function getNutritionDay(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const rows = await queryAll<NutritionEventRow>(
    db,
    `
    SELECT
      id, consumed_at, local_date, alias, label, count, unit,
      kcal, protein_g, fat_g, carbs_g, micros_json, note
    FROM nutrition_events
    WHERE local_date = ?
    ORDER BY consumed_at ASC, id ASC
    `,
    [date],
  )

  let kcal = 0
  let protein = 0
  let fat = 0
  let carbs = 0
  const micros: Record<string, number> = {}

  for (const row of rows) {
    const count = row.count ?? 1
    if (row.kcal != null) {
      kcal += row.kcal * count
    }
    if (row.protein_g != null) {
      protein += row.protein_g * count
    }
    if (row.fat_g != null) {
      fat += row.fat_g * count
    }
    if (row.carbs_g != null) {
      carbs += row.carbs_g * count
    }
    const rowMicros = parseMicros(row.micros_json)
    for (const [key, value] of Object.entries(rowMicros)) {
      micros[key] = (micros[key] ?? 0) + value * count
    }
  }

  return {
    date,
    events: rows.map((row) => ({
      id: row.id,
      consumed_at: row.consumed_at,
      local_date: row.local_date,
      alias: row.alias,
      label: row.label,
      count: row.count,
      kcal: row.kcal,
      protein_g: row.protein_g,
      fat_g: row.fat_g,
      carbs_g: row.carbs_g,
    })),
    totals: {
      kcal: toNullableSum(kcal),
      protein_g: toNullableSum(protein),
      fat_g: toNullableSum(fat),
      carbs_g: toNullableSum(carbs),
      micros,
    },
  }
}


export async function handleNutritionDay(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date')
  if (!date || !isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }
  return jsonResponse(await getNutritionDay(env.DB, date))
}

export function handleSupplements(): Response {
  return jsonResponse({
    supplements: Object.values(SUPPLEMENT_CATALOG).map((item) => ({
      alias: item.alias,
      label: item.label,
      kcal: item.kcal,
      protein_g: item.protein_g,
      fat_g: item.fat_g,
      carbs_g: item.carbs_g,
    })),
  })
}
