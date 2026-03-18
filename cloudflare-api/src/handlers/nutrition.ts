import type { D1Database, Env, NutritionEventRow } from '../types'
import { isValidDate, jsonResponse, parseMicros, queryAll, toIsoDate, toNullableSum, readJsonBody, execute } from '../utils'
import { SUPPLEMENT_CATALOG } from '../constants'

interface SupplementCatalogRow {
  id: number
  alias: string
  label: string
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  unit: string
  micros_json: string | null
  sort_order: number
}

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

export async function handleSupplements(env: Env): Promise<Response> {
  const rows = await queryAll<SupplementCatalogRow>(
    env.DB,
    'SELECT id, alias, label, kcal, protein_g, fat_g, carbs_g, unit, micros_json, sort_order FROM supplement_catalog ORDER BY sort_order ASC, id ASC',
    [],
  )

  if (rows.length > 0) {
    return jsonResponse({
      supplements: rows.map((row) => ({
        id: row.id,
        alias: row.alias,
        label: row.label,
        kcal: row.kcal,
        protein_g: row.protein_g,
        fat_g: row.fat_g,
        carbs_g: row.carbs_g,
        unit: row.unit,
      })),
    })
  }

  // フォールバック: テーブル未マイグレーション時はハードコード値を返す
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

export async function handleSupplementAdd(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(request)
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label) {
    return jsonResponse({ detail: 'label is required' }, 400)
  }

  const alias = typeof body.alias === 'string' ? body.alias.trim() : label.toLowerCase().replace(/\s+/g, '_')
  const kcal = typeof body.kcal === 'number' ? body.kcal : 0
  const protein_g = typeof body.protein_g === 'number' ? body.protein_g : 0
  const fat_g = typeof body.fat_g === 'number' ? body.fat_g : 0
  const carbs_g = typeof body.carbs_g === 'number' ? body.carbs_g : 0
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '錠'
  const micros = body.micros && typeof body.micros === 'object' && !Array.isArray(body.micros) ? body.micros : {}

  const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM supplement_catalog').first() as { max_sort: number } | null
  const sortOrder = (maxRow?.max_sort ?? -1) + 1

  await execute(
    env.DB,
    `INSERT INTO supplement_catalog (alias, label, kcal, protein_g, fat_g, carbs_g, unit, micros_json, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [alias, label, kcal, protein_g, fat_g, carbs_g, unit, JSON.stringify(micros), sortOrder],
  )

  return jsonResponse({ ok: true, alias })
}

export async function handleSupplementDelete(pathname: string, env: Env): Promise<Response> {
  const idRaw = pathname.replace('/api/supplements/', '')
  const id = Number.parseInt(idRaw, 10)
  if (!Number.isInteger(id)) {
    return jsonResponse({ detail: 'Invalid id' }, 400)
  }
  const result = await env.DB.prepare('DELETE FROM supplement_catalog WHERE id = ?').bind(id).run()
  if ((result.meta.changes ?? 0) === 0) {
    return jsonResponse({ detail: 'Supplement not found' }, 404)
  }
  return jsonResponse({ ok: true, deleted_id: id })
}
