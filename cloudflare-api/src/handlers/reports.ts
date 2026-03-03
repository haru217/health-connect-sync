import { REPORT_TYPES, SUPPLEMENT_CATALOG } from '../constants'
import type { D1Database, Env, ReportRow, ReportType } from '../types'
import { execute, isValidDate, jsonResponse, nowIso, queryAll, queryFirst, readJsonBody, toIsoDate } from '../utils'
import { getNutritionDay } from './nutrition'
import { getUserProfile } from './profile'
import { statusByRule } from './scores'

export async function computeTargets(db: D1Database, date: string): Promise<Record<string, unknown>> {
  const profile = await getUserProfile(db)
  const latestWeight = await queryFirst<{ weight_kg: number | null }>(
    db,
    'SELECT weight_kg FROM daily_metrics WHERE weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1',
  )
  const day = await getNutritionDay(db, date)
  const totals = day.totals as {
    kcal: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
    micros: Record<string, number>
  }

  const heightCm = profile?.height_cm ?? 172
  const age = profile?.age ?? 38
  const sex = profile?.gender ?? 'male'
  const weightKg = latestWeight?.weight_kg ?? 70

  const bmr =
    sex === 'female'
      ? 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
      : 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
  const tdee = bmr * 1.55
  const targetKcal = tdee * 0.8

  const proteinTarget = (targetKcal * 0.3) / 4
  const fatTarget = (targetKcal * 0.25) / 9
  const carbsTarget = (targetKcal * 0.45) / 4

  const microTargets: Array<{ key: string; name: string; unit: string; target: number }> = [
    { key: 'vitamin_d3_mcg', name: '\u30d3\u30bf\u30df\u30f3D', unit: '\u03bcg', target: 15 },
    { key: 'vitamin_c_mg', name: '\u30d3\u30bf\u30df\u30f3C', unit: 'mg', target: 100 },
    { key: 'vitamin_e_mg', name: '\u30d3\u30bf\u30df\u30f3E', unit: 'mg', target: sex === 'female' ? 5 : 6 },
    { key: 'folate_mcg', name: '\u8449\u9178', unit: '\u03bcg', target: 240 },
    { key: 'calcium_mg', name: '\u30ab\u30eb\u30b7\u30a6\u30e0', unit: 'mg', target: sex === 'female' ? 650 : 750 },
    { key: 'magnesium_mg', name: '\u30de\u30b0\u30cd\u30b7\u30a6\u30e0', unit: 'mg', target: sex === 'female' ? 290 : 370 },
    { key: 'zinc_mg', name: '\u4e9c\u925b', unit: 'mg', target: sex === 'female' ? 8 : 11 },
    { key: 'omega3_mg', name: '\u30aa\u30e1\u30ac3', unit: 'mg', target: 2000 },
  ]

  const targets = [
    {
      key: 'energy_kcal',
      name: '\u30a8\u30cd\u30eb\u30ae\u30fc',
      unit: 'kcal',
      target: Number(targetKcal.toFixed(0)),
      actual: totals.kcal,
      status: statusByRule(totals.kcal, targetKcal, 'range'),
      rule: 'range',
    },
    {
      key: 'protein_g',
      name: '\u30bf\u30f3\u30d1\u30af\u8cea',
      unit: 'g',
      target: Number(proteinTarget.toFixed(1)),
      actual: totals.protein_g,
      status: statusByRule(totals.protein_g, proteinTarget, 'min'),
      rule: 'min',
    },
    {
      key: 'fat_g',
      name: '\u8102\u8cea',
      unit: 'g',
      target: Number(fatTarget.toFixed(1)),
      actual: totals.fat_g,
      status: statusByRule(totals.fat_g, fatTarget, 'max'),
      rule: 'max',
    },
    {
      key: 'carbs_g',
      name: '\u70ad\u6c34\u5316\u7269',
      unit: 'g',
      target: Number(carbsTarget.toFixed(1)),
      actual: totals.carbs_g,
      status: statusByRule(totals.carbs_g, carbsTarget, 'range'),
      rule: 'range',
    },
    ...microTargets.map((target) => {
      const actual = totals.micros[target.key] ?? null
      return {
        key: target.key,
        name: target.name,
        unit: target.unit,
        target: target.target,
        actual,
        status: statusByRule(actual, target.target, 'min'),
        rule: 'min',
      }
    }),
  ]

  return { targets }
}

export async function saveReport(db: D1Database, payload: Record<string, unknown>): Promise<ReportRow> {
  const reportDate = payload.report_date
  const reportType = payload.report_type
  const promptUsed = payload.prompt_used
  const content = payload.content

  if (!isValidDate(reportDate)) {
    throw new Error('report_date must be YYYY-MM-DD')
  }
  if (typeof reportType !== 'string' || !REPORT_TYPES.includes(reportType as ReportType)) {
    throw new Error('report_type must be daily | weekly | monthly')
  }
  if (typeof promptUsed !== 'string' || typeof content !== 'string') {
    throw new Error('prompt_used and content are required strings')
  }

  await execute(
    db,
    `
    INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(report_date, report_type) DO UPDATE SET
      prompt_used = excluded.prompt_used,
      content = excluded.content,
      created_at = excluded.created_at
    `,
    [reportDate, reportType, promptUsed, content, nowIso()],
  )

  const row = await queryFirst<ReportRow>(
    db,
    `
    SELECT id, report_date, report_type, prompt_used, content, created_at
    FROM ai_reports
    WHERE report_date = ? AND report_type = ?
    `,
    [reportDate, reportType],
  )
  if (!row) {
    throw new Error('saved report could not be read back')
  }
  return row
}

export async function listReports(db: D1Database, reportType: string | null): Promise<Record<string, unknown>> {
  if (reportType && !REPORT_TYPES.includes(reportType as ReportType)) {
    throw new Error('report_type must be daily | weekly | monthly')
  }
  const rows = reportType
    ? await queryAll<ReportRow & { preview: string }>(
        db,
        `
        SELECT id, report_date, report_type, prompt_used, content, created_at, SUBSTR(content, 1, 200) AS preview
        FROM ai_reports
        WHERE report_type = ?
        ORDER BY report_date DESC, created_at DESC
        LIMIT 50
        `,
        [reportType],
      )
    : await queryAll<ReportRow & { preview: string }>(
        db,
        `
        SELECT id, report_date, report_type, prompt_used, content, created_at, SUBSTR(content, 1, 200) AS preview
        FROM ai_reports
        ORDER BY report_date DESC, created_at DESC
        LIMIT 50
        `,
      )

  return {
    reports: rows.map((row) => ({
      id: row.id,
      report_date: row.report_date,
      report_type: row.report_type,
      created_at: row.created_at,
      preview: row.preview,
    })),
  }
}

export async function getReport(db: D1Database, reportId: number): Promise<ReportRow | null> {
  const row = await queryFirst<ReportRow>(
    db,
    `
    SELECT id, report_date, report_type, prompt_used, content, created_at
    FROM ai_reports
    WHERE id = ?
    `,
    [reportId],
  )
  return row ?? null
}

export async function deleteReport(db: D1Database, reportId: number): Promise<Record<string, unknown>> {
  const result = await db.prepare('DELETE FROM ai_reports WHERE id = ?').bind(reportId).run()
  return { ok: (result.meta.changes ?? 0) > 0, deleted_id: reportId }
}

export function makePrompt(type: ReportType): string {
  const date = toIsoDate(new Date())
  const title =
    type === 'daily'
      ? '\u65e5\u6b21'
      : type === 'weekly'
        ? '\u9031\u6b21'
        : '\u6708\u6b21'
  return [
    `# ${title}\u30ec\u30dd\u30fc\u30c8\u4f5c\u6210\u30d7\u30ed\u30f3\u30d7\u30c8`,
    `\u65e5\u4ed8: ${date}`,
    '\u5065\u5eb7\u6307\u6a19\u30fb\u7761\u7720\u30fb\u98df\u4e8b\u3092\u898b\u3066\u3001',
    '\u533b\u5e2b\u3001\u30c8\u30ec\u30fc\u30ca\u30fc\u3001\u7ba1\u7406\u6804\u990a\u58eb\u306e3\u8996\u70b9\u3067\u30b3\u30e1\u30f3\u30c8\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
    '\u30de\u30fc\u30ab\u30fc\u5f62\u5f0f:',
    '<!--DOCTOR-->',
    '<!--TRAINER-->',
    '<!--NUTRITIONIST-->',
    '<!--END-->',
  ].join('\n')
}

export async function seedMockData(db: D1Database): Promise<Record<string, unknown>> {
  await execute(db, 'DELETE FROM sync_runs')
  await execute(db, 'DELETE FROM sync_cursor_state')
  await execute(db, 'DELETE FROM health_records')
  await execute(db, 'DELETE FROM nutrition_events')
  await execute(db, 'DELETE FROM ai_reports')
  await execute(db, 'DELETE FROM daily_metrics')
  await execute(db, 'DELETE FROM user_profiles')
  await execute(db, 'DELETE FROM record_type_counts')

  await execute(
    db,
    `
    INSERT INTO user_profiles(
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal, updated_at
    )
    VALUES('default', 38, 'male', 172, 72, 420, 8000, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      age = 38,
      gender = 'male',
      height_cm = 172,
      goal_weight_kg = 72,
      sleep_goal_minutes = 420,
      steps_goal = 8000,
      updated_at = excluded.updated_at
    `,
    [nowIso()],
  )

  const today = new Date()
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const isoDate = toIsoDate(d)
    const progress = 29 - i
    const steps = 7000 + ((progress * 311) % 3600)
    const active = 280 + ((progress * 17) % 210)
    const bmr = 1670
    const total = bmr + active
    const intake = 1780 + ((progress * 29) % 240)
    const weight = Number((76 - progress * 0.04 + ((i % 3) - 1) * 0.05).toFixed(2))
    const bodyFat = Number((22 - progress * 0.03).toFixed(2))
    const sleep = Number((i === 0 ? 6.12 : 6.4 + (progress % 4) * 0.25).toFixed(2))
    const resting = 61 + (progress % 5)
    const heart = 76 + (progress % 9)
    const spo2 = Number((97 + (progress % 2) * 0.4).toFixed(1))
    const sys = 116 + (progress % 8)
    const dia = 75 + (progress % 6)
    const km = Number((steps * 0.00075).toFixed(2))

    await execute(
      db,
      `
      INSERT INTO daily_metrics(
        date, steps, distance_km, active_kcal, total_kcal, intake_kcal,
        sleep_hours, weight_kg, body_fat_pct, resting_bpm, heart_bpm, spo2_pct,
        blood_systolic, blood_diastolic, bmr_kcal, record_count
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [isoDate, steps, km, active, total, intake, sleep, weight, bodyFat, resting, heart, spo2, sys, dia, bmr, 12],
    )
  }

  await execute(
    db,
    'INSERT INTO record_type_counts(record_type, count) VALUES(?, ?)',
    ['DailyMetricRecord', 360],
  )

  const todayDate = toIsoDate(today)
  const protein = SUPPLEMENT_CATALOG.protein
  const vitaminD = SUPPLEMENT_CATALOG.vitamin_d
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T07:30:00.000Z`,
      todayDate,
      'protein',
      protein.label,
      1,
      protein.unit,
      protein.kcal,
      protein.protein_g,
      protein.fat_g,
      protein.carbs_g,
      JSON.stringify(protein.micros ?? {}),
      null,
    ],
  )
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T08:00:00.000Z`,
      todayDate,
      'vitamin_d',
      vitaminD.label,
      2,
      vitaminD.unit,
      vitaminD.kcal,
      vitaminD.protein_g,
      vitaminD.fat_g,
      vitaminD.carbs_g,
      JSON.stringify(vitaminD.micros ?? {}),
      null,
    ],
  )
  await execute(
    db,
    `
    INSERT INTO nutrition_events(
      consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `${todayDate}T12:20:00.000Z`,
      todayDate,
      null,
      '\u30c1\u30ad\u30f3\u30b5\u30e9\u30c0\u30dc\u30a6\u30eb',
      1,
      null,
      620,
      35,
      20,
      70,
      JSON.stringify({ vitamin_c_mg: 35, calcium_mg: 120 }),
      null,
    ],
  )

  const defaultContent = [
    '<!--DOCTOR-->',
    '\u7761\u7720\u306f6\u6642\u9593\u53f0\u306a\u306e\u3067\u3001\u4eca\u9031\u306f7\u6642\u9593\u76ee\u6a19\u306b\u30b7\u30d5\u30c8\u3057\u307e\u3057\u3087\u3046\u3002',
    '<!--TRAINER-->',
    '\u6b69\u6570\u306f\u5b89\u5b9a\u3057\u3066\u3044\u307e\u3059\u3002\u591c\u306b10\u5206\u3060\u3051\u8ffd\u52a0\u30a6\u30a9\u30fc\u30af\u3092\u5165\u308c\u308b\u3068\u826f\u3044\u3067\u3059\u3002',
    '<!--NUTRITIONIST-->',
    '\u30d3\u30bf\u30df\u30f3D\u3068\u305f\u3093\u3071\u304f\u8cea\u306f\u78ba\u4fdd\u3067\u304d\u3066\u3044\u307e\u3059\u3002\u91ce\u83dc\u3068\u6c34\u5206\u3092\u8db3\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002',
    '<!--END-->',
  ].join('\n')

  for (const type of REPORT_TYPES) {
    await execute(
      db,
      `
      INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
      VALUES(?, ?, ?, ?, ?)
      `,
      [todayDate, type, makePrompt(type), defaultContent, nowIso()],
    )
  }

  return {
    ok: true,
    seededDate: todayDate,
    metricDays: 30,
    reports: REPORT_TYPES.length,
  }
}


export async function handleNutrientsTargets(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get('date')
  if (!date || !isValidDate(date)) {
    return jsonResponse({ detail: 'date query must be YYYY-MM-DD' }, 400)
  }
  return jsonResponse(await computeTargets(env.DB, date))
}

export function handlePrompt(url: URL): Response {
  const reportType = url.searchParams.get('type') ?? 'daily'
  if (!REPORT_TYPES.includes(reportType as ReportType)) {
    return jsonResponse({ detail: 'type must be daily | weekly | monthly' }, 400)
  }
  return jsonResponse({
    type: reportType,
    prompt: makePrompt(reportType as ReportType),
  })
}

export async function handleReportsGet(url: URL, env: Env): Promise<Response> {
  const reportType = url.searchParams.get('report_type')
  return jsonResponse(await listReports(env.DB, reportType))
}

export async function handleReportsPost(request: Request, env: Env): Promise<Response> {
  const payload = await readJsonBody(request)
  return jsonResponse(await saveReport(env.DB, payload), 201)
}

export async function handleReportById(pathname: string, env: Env): Promise<Response> {
  const idRaw = pathname.replace('/api/reports/', '')
  const id = Number.parseInt(idRaw, 10)
  if (!Number.isInteger(id)) {
    return jsonResponse({ detail: 'Invalid id' }, 400)
  }
  const report = await getReport(env.DB, id)
  if (!report) {
    return jsonResponse({ detail: 'Report not found' }, 404)
  }
  return jsonResponse(report)
}

export async function handleReportDeleteById(pathname: string, env: Env): Promise<Response> {
  const idRaw = pathname.replace('/api/reports/', '')
  const id = Number.parseInt(idRaw, 10)
  if (!Number.isInteger(id)) {
    return jsonResponse({ detail: 'Invalid id' }, 400)
  }
  return jsonResponse(await deleteReport(env.DB, id))
}

export async function handleSeedMock(request: Request, env: Env): Promise<Response> {
  const seedToken = (env.MOCK_SEED_TOKEN ?? '').trim()
  if (seedToken) {
    const provided = request.headers.get('X-Seed-Token') ?? request.headers.get('x-seed-token') ?? ''
    if (provided.trim() !== seedToken) {
      return jsonResponse({ detail: 'Forbidden' }, 403)
    }
  }
  return jsonResponse(await seedMockData(env.DB))
}

