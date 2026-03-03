import { SUPPLEMENT_CATALOG } from '../constants'
import type { Env } from '../types'
import { execute, jsonResponse, readJsonBody, toNumberOrNull, toPositiveCount } from '../utils'
import { rebuildAggregatesFromHealthRecords } from './sync-aggregate'
import { resolveDateAndTime } from './nutrition'

export async function handleNutritionLog(request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody(request)
  const rawItems = Array.isArray(payload.items) ? payload.items : [payload]
  const items = rawItems.filter((item): item is Record<string, unknown> => {
    return !!item && typeof item === 'object' && !Array.isArray(item)
  })

  if (items.length === 0) {
    return jsonResponse({ detail: 'No valid items' }, 400)
  }

  for (const item of items) {
    const alias = typeof item.alias === 'string' ? item.alias : null
    const label = typeof item.label === 'string' ? item.label.trim() : null
    const count = toPositiveCount(item.count, 1)
    const baseSource = alias ? SUPPLEMENT_CATALOG[alias] : null

    if (!baseSource && !label) {
      return jsonResponse({ detail: 'alias or label is required' }, 400)
    }

    const { consumedAt, localDate } = resolveDateAndTime({
      consumed_at: item.consumed_at ?? payload.consumed_at,
      local_date: item.local_date ?? payload.local_date,
    })

    const kcal = baseSource?.kcal ?? toNumberOrNull(item.kcal)
    const protein = baseSource?.protein_g ?? toNumberOrNull(item.protein_g)
    const fat = baseSource?.fat_g ?? toNumberOrNull(item.fat_g)
    const carbs = baseSource?.carbs_g ?? toNumberOrNull(item.carbs_g)
    const note = typeof item.note === 'string' ? item.note : null

    let micros: Record<string, number> = {}
    if (baseSource?.micros) {
      micros = { ...baseSource.micros }
    } else if (item.micros && typeof item.micros === 'object' && !Array.isArray(item.micros)) {
      const entries = Object.entries(item.micros).filter((entry): entry is [string, number] => {
        const [, value] = entry
        return typeof value === 'number' && Number.isFinite(value)
      })
      micros = Object.fromEntries(entries)
    }

    await execute(
      env.DB,
      `
      INSERT INTO nutrition_events(
        consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        consumedAt,
        localDate,
        alias,
        baseSource?.label ?? label,
        count,
        baseSource?.unit ?? null,
        kcal,
        protein,
        fat,
        carbs,
        JSON.stringify(micros),
        note,
      ],
    )
  }

  return jsonResponse({ ok: true, count: items.length })
}


export async function handleNutritionLogPost(request: Request, env: Env): Promise<Response> {
  const response = await handleNutritionLog(request, env)
  await rebuildAggregatesFromHealthRecords(env.DB)
  return response
}

export async function handleNutritionLogDelete(pathname: string, env: Env): Promise<Response> {
  const idRaw = pathname.replace('/api/nutrition/log/', '')
  const id = Number.parseInt(idRaw, 10)
  if (!Number.isInteger(id)) {
    return jsonResponse({ detail: 'Invalid id' }, 400)
  }
  const result = await env.DB.prepare('DELETE FROM nutrition_events WHERE id = ?').bind(id).run()
  if ((result.meta.changes ?? 0) === 0) {
    return jsonResponse({ detail: 'Event not found' }, 404)
  }
  await rebuildAggregatesFromHealthRecords(env.DB)
  return jsonResponse({ ok: true, deleted_id: id })
}
