# Request: 未記録食事がある日の摂取カロリーをレポートから除外（U9v2）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（レポート改善）
- Depends on: U9 完了済み
- Priority: 高

## 問題

U9で食事タイプ別の記録状況をLLMに伝えるようにしたが、LLMが「朝食と昼食の記録がないため、実際の摂取量はもう少し多い可能性があります」のような回りくどい言及をしてしまう。

**CEO方針**: 不完全な食事データはLLMに渡さない。LLMの判断に頼らず、入力段階でフィルタする。

## 修正内容

### 1. `loadHaruPromptContext` で食事記録の完全性フラグを返す

```typescript
export interface HaruPromptContext {
  profile: UserProfileRow
  scores: Record<string, unknown>
  trendRows: DailyReportTrendRow[]
  nutritionEvents: DailyNutritionEventRow[]
  mealCoverageComplete: boolean  // 追加: 朝食・昼食・夕食が全て記録されているか
}
```

`loadHaruPromptContext` 内で判定:
```typescript
const mealTypes = new Set(nutritionEvents.map(e => e.meal_type?.trim().toLowerCase()).filter(Boolean))
const mealCoverageComplete = ['breakfast', 'lunch', 'dinner'].every(t => mealTypes.has(t))
```

### 2. `buildHaruUserPrompt` で不完全な日のintake_kcalを隠す

`mealCoverageComplete` が `false` の場合:
- トレンドテーブルの**データ対象日**の `intake_kcal`, `protein`, `fat`, `carbs` 列を `-` に置換
- 食事詳細セクション自体を「食事記録が不完全なため省略」に置換

```typescript
export function buildHaruUserPrompt(options: HaruUserPromptOptions): string {
  const dataDate = shiftIsoDateByDays(options.date, -1)
  // ...

  // 食事データが不完全な場合、トレンドテーブルの該当日のintake関連を隠す
  const trendRows = options.mealCoverageComplete
    ? options.trendRows
    : options.trendRows.map(row =>
        row.date === dataDate
          ? { ...row, intake_kcal: null, protein_g: null, fat_g: null, carbs_g: null }
          : row
      )

  // 食事詳細セクション
  const nutritionSection = options.mealCoverageComplete
    ? formatNutritionEventsForPrompt(options.nutritionEvents)
    : '（朝食・昼食・夕食の一部が未記録のため、食事データは参考外）'

  return [
    `# レポート日: ${options.date}朝`,
    `# データ対象日: ${dataDate}（「昨日」= この日のことです）`,
    `# 睡眠データは起床日(${options.date})の記録です`,
    '',
    '# 14日間のデータ',
    '| date | steps | sleep_h | weight | fat% | BP | active_kcal | total_kcal | intake_kcal | protein | fat | carbs |',
    buildTrendRowsTable(dataDate, trendRows),
    '',
    '# データ対象日の食事記録',
    nutritionSection,
    // ...
  ].join('\n')
}
```

### 3. `HaruUserPromptOptions` に `mealCoverageComplete` 追加

```typescript
export interface HaruUserPromptOptions {
  date: string
  trendRows: DailyReportTrendRow[]
  nutritionEvents: DailyNutritionEventRow[]
  scores: Record<string, unknown>
  templatePrompt?: string
  mealCoverageComplete: boolean  // 追加
}
```

### 4. システムプロンプトの食事ルールを簡潔に変更

U9で追加した `# 食事データの注意` セクションを以下に置換:

```typescript
'',
'# 食事データの注意',
'- intake_kcalが`-`の日は食事データが不完全（未入力あり）。その日の摂取カロリーには一切言及しないこと',
'- 食事記録セクションが「参考外」の場合も同様に、食事に関するコメントを控えること',
```

### 5. `formatNutritionEventsForPrompt` の未記録警告を削除

U9で追加した `⚠ ${missingLabels}の記録なし...` の行は不要になるので削除する。meal_type別のグループ表示は残す（完全な日には表示されるため）。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/report.ts` | 上記全て |

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

デプロイ後にレポート再生成して、摂取カロリーへの言及がないことを確認:
```bash
curl -k -X POST -H "X-Api-Key: <KEY>" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-05","force":true}' \
  "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/report/generate"
```
