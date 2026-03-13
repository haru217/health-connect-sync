# Request: レポート日付モデルを「読む日」ベースに変更（U6）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（UX改善）
- Depends on: なし
- Priority: 最高

## 概要

レポートの `date` フィールドの意味を「データの対象日」から「ユーザーがレポートを読む朝の日付」に変更する。

### 現状（問題あり）
- `date=3/4` のレポート → 3/4のデータ対象 → 3/5朝に読む
- LLMが「昨日」を3/3と解釈してしまう（3/4のデータを指すべき）

### 変更後
- `date=3/5` のレポート → **3/5の朝に読む**レポート
  - 歩数・体重・血圧・活動: **3/4**のデータ（前日）
  - 睡眠: **3/5**のデータ（起床日ベース）
  - トレンド14日分: 2/20〜3/4
  - LLMの「昨日」= 3/4 ✓

## 変更内容

### 1. `cloudflare-api/src/handlers/sync.ts`

sync後の自動レポート生成を `yesterday` → `today` に変更:

```typescript
// Before:
const yesterday = toIsoDate(new Date(Date.now() - 86_400_000))
ctx.waitUntil(generateDailyReportIfNeeded(env, yesterday)...)

// After:
const today = toIsoDate(new Date())
ctx.waitUntil(generateDailyReportIfNeeded(env, today)...)
```

### 2. `cloudflare-api/src/handlers/report.ts`

#### `buildHaruUserPrompt` の変更

`date` は「読む日」なので、データ対象日は `date - 1` に変更:

```typescript
export function buildHaruUserPrompt(options: HaruUserPromptOptions): string {
  const dataDate = shiftIsoDateByDays(options.date, -1)  // 前日のデータが対象
  // ...
  return [
    `# レポート日: ${options.date}朝`,
    `# データ対象日: ${dataDate}（「昨日」= この日のことです）`,
    `# 睡眠データは起床日(${options.date})の記録です`,
    '',
    '# 14日間のデータ',
    '| date | steps | sleep_h | weight | fat% | BP | active_kcal | total_kcal | intake_kcal | protein | fat | carbs |',
    buildTrendRowsTable(dataDate, options.trendRows),  // dataDateまでの14日間
    // ...
  ].join('\n')
}
```

#### `queryDailyReportTrendRows` の呼び出し変更

`loadHaruPromptContext` で、トレンドデータと食事データの対象日を `date - 1` にする:

```typescript
export async function loadHaruPromptContext(db: D1Database, date: string): Promise<HaruPromptContext> {
  const dataDate = shiftIsoDateByDays(date, -1)  // 前日のデータが対象
  const [profile, scores, trendRows, nutritionEvents] = await Promise.all([
    getUserProfile(db),
    getScores(db, dataDate),           // 前日のスコア
    queryDailyReportTrendRows(db, dataDate),  // 前日までの14日間
    queryDailyNutritionEvents(db, dataDate),  // 前日の食事
  ])
  return { profile, scores, trendRows, nutritionEvents }
}
```

#### `buildHaruSystemPrompt` の時制ルール更新

```typescript
// 既存の時制ルールセクションを修正:
'# 時制ルール',
'- ユーザーはこのレポートを当日の朝に読みます',
'- 「昨日」= データ対象日（前日）のこと',
'- 「今日」は提案のみOK: 「今日は〜してみると良いかもしれません」',
```

### 3. `cloudflare-api/src/handlers/home-summary.ts`

レポート検索を `WHERE date <= ?` → `WHERE date <= ?` のままで良い（読む日ベースなので、3/5で開いたら date=3/5 のレポートが返る）。

ただし、将来的に当日のレポートがない場合も前日のレポートを表示できるように `WHERE date <= ?` を維持する。

### 4. 既存レポートの移行

既存の `daily_reports` のdateを +1日シフトする:

```sql
UPDATE daily_reports SET date = DATE(date, '+1 day')
```

これにより既存レポートのdateが「読む日」に統一される。

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

修正後:
1. デプロイ: `cd cloudflare-api && npx wrangler deploy`
2. 既存レポート移行SQL実行
3. レポート再生成: `POST /api/report/generate` with `{"date":"2026-03-05","force":true}`
4. 確認: `GET /api/home-summary?date=2026-03-05` でレポートが3/4のデータを「昨日」として参照していること
