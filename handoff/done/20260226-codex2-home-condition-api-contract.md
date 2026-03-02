# Handoff: Home / Condition Cloudflare API Contract (Codex-2)

- Date: 2026-02-26
- From: Codex2
- To: CEO / Claude (PMO) / Codex-1
- Request: Home / Condition API 契約確定
- Status: `done` (契約定義のみ)

## Summary
- Home/Condition が使用する API 契約を確定しました。
- 対象は `/api/home-summary`, `/api/body-data`, `/api/sleep-data`, `/api/vitals-data` です。
- `/api/summary` 依存は現行 Home/Condition にはありません（`web-app/src/api/healthApi.ts:80-97`）。
- `ops/CEO_DASHBOARD.html` は変更していません（`P1-1-5` は in_progress 維持）。
- プロフィール整備には着手していません。

## Contract (Response Fields + Query)

### 1) `GET /api/home-summary`
- Query:
  - `date`: 任意。未指定時はサーバー当日 (`YYYY-MM-DD`) を使用（`cloudflare-api/src/index.ts:3486`）。
  - 形式不正は `400`（`cloudflare-api/src/index.ts:3488`）。
- Response fields:
  - `date: string`
  - `report: { content: string; created_at: string } | null`
  - `sufficiency: { sleep: boolean; steps: boolean; weight: boolean; meal: boolean; bp: boolean }`
  - `evidences: Array<{ type: string; label: string; value: string; tab: 'home'|'health'|'exercise'|'meal'|'my'; innerTab?: string }>`
  - `statusItems: Array<{ key: 'sleep'|'steps'|'meal'|'weight'|'bp'; label: string; value: string|null; ok: boolean; tab: 'home'|'health'|'exercise'|'meal'|'my'; innerTab?: 'composition'|'vital'|'sleep'; tone?: 'normal'|'warning'|'critical'; progress?: number }>`
  - `attentionPoints: Array<{ id: string; icon: 'warning'|'down'|'up'|'check'|'alert'; message: string; severity: 'critical'|'warning'|'info'|'positive'; category: 'threshold'|'trend'|'achievement'; navigateTo: { tab: 'home'|'health'|'exercise'|'meal'|'my'; subTab?: 'composition'|'vital'|'sleep' }; dataSource: string }>`
  - `previousReport: { date: string; created_at: string } | null`
- Source:
  - builder: `cloudflare-api/src/index.ts:1554-1861`
  - route: `cloudflare-api/src/index.ts:3485-3492`
  - frontend型: `web-app/src/api/types.ts:257-265`

### 2) `GET /api/body-data`
- Query:
  - `date`: 必須 `YYYY-MM-DD`（`cloudflare-api/src/index.ts:3547`）
  - `period`: 必須 `week|month|year`（`cloudflare-api/src/index.ts:3550`）
- Response fields:
  - `baseDate: string`
  - `period: 'week'|'month'|'year'`
  - `current: { weight_kg: number|null; body_fat_pct: number|null; bmi: number|null; bmr_kcal: number|null }`
  - `goalWeight: number|null`
  - `series: Array<{ date: string; weight_kg: number|null; body_fat_pct: number|null; bmr_kcal: number|null }>`
  - `periodSummary: { avg_weight_kg: number|null; avg_body_fat_pct: number|null; avg_bmi: number|null; points: number }`
- Source:
  - builder: `cloudflare-api/src/index.ts:2078-2227`
  - route: `cloudflare-api/src/index.ts:3543-3554`
  - frontend型: `web-app/src/api/types.ts:288-313`

### 3) `GET /api/sleep-data`
- Query:
  - `date`: 必須 `YYYY-MM-DD`（`cloudflare-api/src/index.ts:3560`）
  - `period`: 必須 `week|month|year`（`cloudflare-api/src/index.ts:3563`）
- Response fields:
  - `baseDate: string`
  - `period: 'week'|'month'|'year'`
  - `current: { sleep_minutes: number|null; bedtime: string|null; wake_time: string|null; avg_spo2: number|null; min_spo2: number|null }`
  - `stages: { deep_min: number|null; light_min: number|null; rem_min: number|null }`
  - `series: Array<{ date: string; sleep_minutes: number|null; deep_min: number|null; light_min: number|null; rem_min: number|null }>`
  - `periodSummary: { avg_sleep_min: number|null; goal_days: number; measured_days: number; goal_rate: number|null; avg_deep_min: number|null; avg_light_min: number|null; avg_rem_min: number|null; deep_ratio: number|null; light_ratio: number|null; rem_ratio: number|null; avg_spo2: number|null; min_spo2: number|null }`
  - `latestSleepDate: string|null` (API実レスポンスに含まれる追加項目)
- Source:
  - builder: `cloudflare-api/src/index.ts:2330-2515`
  - route: `cloudflare-api/src/index.ts:3556-3567`
  - frontend型: `web-app/src/api/types.ts:315-354`

### 4) `GET /api/vitals-data`
- Query:
  - `date`: 必須 `YYYY-MM-DD`（`cloudflare-api/src/index.ts:3573`）
  - `period`: 必須 `week|month|year`（`cloudflare-api/src/index.ts:3576`）
- Response fields:
  - `baseDate: string`
  - `period: 'week'|'month'|'year'`
  - `current: { systolic: number|null; diastolic: number|null; resting_hr: number|null }`
  - `series: Array<{ date: string; systolic: number|null; diastolic: number|null; resting_hr: number|null }>`
  - `periodSummary: { avg_systolic: number|null; avg_diastolic: number|null; avg_resting_hr: number|null; high_bp_points: number }`
- Source:
  - builder: `cloudflare-api/src/index.ts:2518-2635`
  - route: `cloudflare-api/src/index.ts:3569-3580`
  - frontend型: `web-app/src/api/types.ts:356-379`

## Error Behavior (確定)

### Common
- `401 {"detail":"Unauthorized"}`:
  - `/api/*` に対して APIキー不一致時。
  - ただし `env.API_KEY` が空なら認証はスキップ（`cloudflare-api/src/index.ts:253-259`, `3463-3465`）。
- `404 {"detail":"Not found: <METHOD> <PATH>"}`:
  - 未定義エンドポイント（`cloudflare-api/src/index.ts:3705`）。
- `500 text/plain`:
  - 想定外例外時。JSONではなく plain text（`cloudflare-api/src/index.ts:3707-3708`, `236-243`）。

### Endpoint validation errors
- `/api/home-summary`:
  - `400 {"detail":"date query must be YYYY-MM-DD"}`
- `/api/body-data`, `/api/sleep-data`, `/api/vitals-data`:
  - `400 {"detail":"date query must be YYYY-MM-DD"}`
  - `400 {"detail":"period query must be week | month | year"}`

## Sample Responses (Local, 2026-02-26)

### `/api/home-summary?date=2026-02-26`
```json
{
  "date": "2026-02-26",
  "report": { "content": "<!--DOCTOR-->...", "created_at": "2026-02-26T14:13:59.279Z" },
  "sufficiency": { "sleep": true, "steps": true, "weight": true, "meal": true, "bp": true },
  "statusItems": [
    { "key": "sleep", "value": "6h07m", "progress": 87 },
    { "key": "steps", "value": "8,819", "progress": 100 }
  ],
  "attentionPoints": [
    { "id": "steps-good-2026-02-26", "severity": "positive", "category": "achievement" }
  ],
  "previousReport": null
}
```

### `/api/body-data?date=2026-02-26&period=week`
```json
{
  "baseDate": "2026-02-26",
  "period": "week",
  "current": { "weight_kg": 74.79, "body_fat_pct": 21.13, "bmi": 25.280557057869125, "bmr_kcal": 1670 },
  "goalWeight": 72,
  "series": [{ "date": "2026-02-20", "weight_kg": 75.03, "body_fat_pct": 21.31, "bmr_kcal": 1670 }],
  "periodSummary": { "avg_weight_kg": 74.95285714285714, "avg_body_fat_pct": 21.22, "avg_bmi": 25.33560611913776, "points": 7 }
}
```

### `/api/sleep-data?date=2026-02-26&period=week`
```json
{
  "baseDate": "2026-02-26",
  "period": "week",
  "current": { "sleep_minutes": 367, "bedtime": null, "wake_time": null, "avg_spo2": 97.4, "min_spo2": 97.4 },
  "stages": { "deep_min": null, "light_min": null, "rem_min": null },
  "series": [{ "date": "2026-02-20", "sleep_minutes": 429, "deep_min": null, "light_min": null, "rem_min": null }],
  "periodSummary": { "avg_sleep_min": 400.85714285714283, "goal_days": 2, "measured_days": 7, "goal_rate": 0.2857142857142857 },
  "latestSleepDate": "2026-02-26"
}
```

### `/api/vitals-data?date=2026-02-26&period=week`
```json
{
  "baseDate": "2026-02-26",
  "period": "week",
  "current": { "systolic": 121, "diastolic": 80, "resting_hr": 65 },
  "series": [{ "date": "2026-02-20", "systolic": 123, "diastolic": 80, "resting_hr": 64 }],
  "periodSummary": { "avg_systolic": 119.14285714285714, "avg_diastolic": 77.85714285714286, "avg_resting_hr": 63.42857142857143, "high_bp_points": 0 }
}
```

## Gap List (契約/実装/利用)

1. `latestSleepDate` が API には存在するが、`SleepDataResponse` 型に未定義。
- API: `cloudflare-api/src/index.ts:2514`
- 型: `web-app/src/api/types.ts:324-354`

2. 認証挙動が環境依存（`API_KEY` 未設定時は `/api/*` が無認証通過）。
- local 実測で `X-Api-Key` なしでも `200` を確認。
- 実装: `cloudflare-api/src/index.ts:253-259`

3. `period=year` 時の `series[].date` は `YYYY-MM`（月単位）になるが、型は単なる `string`。
- 実装: `cloudflare-api/src/index.ts:2056-2061`
- 利用側で日付粒度を固定前提にすると誤解余地あり。

## CEO Decision Hold
- `P1-1-5` は `in_progress` 維持。
- `done` 更新は「Home/Condition の CEO 最終決裁完了」まで保留。
