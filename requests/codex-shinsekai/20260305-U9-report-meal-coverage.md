# Request: レポートに食事タイプ別記録状況を追加（U9）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（レポート改善）
- Depends on: U6（レポート日付モデル）完了済み
- Priority: 高

## 問題

食事記録が朝食/昼食/夕食/間食に分類されるようになったが、レポート（ハルブリーフィング）はこの分類を認識していない。

例: ユーザーが朝食と夕食だけ記録し昼食を入力し忘れた場合、摂取カロリーが実際より低く表示される。レポートが「摂取カロリーが少ない」と指摘すると誤解を招く。

## 修正内容

### 1. `DailyNutritionEventRow` に `meal_type` 追加

```typescript
export interface DailyNutritionEventRow {
  consumed_at: string | null
  label: string
  count: number | null
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  note: string | null
  meal_type: string | null  // 追加
}
```

### 2. `queryDailyNutritionEvents` に `meal_type` 追加

```typescript
SELECT
  consumed_at, label, count, kcal, protein_g, fat_g, carbs_g, note, meal_type
FROM nutrition_events
WHERE local_date = ?
ORDER BY consumed_at ASC, id ASC
```

### 3. `formatNutritionEventsForPrompt` を meal_type 別にグループ化

```typescript
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABELS: Record<string, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
}

function formatNutritionEventsForPrompt(events: DailyNutritionEventRow[]): string {
  if (events.length === 0) {
    return '食事記録なし'
  }

  // meal_type別にグループ化
  const grouped = new Map<string, DailyNutritionEventRow[]>()
  const noType: DailyNutritionEventRow[] = []

  for (const event of events) {
    const mt = event.meal_type?.trim() || ''
    if (mt && MEAL_LABELS[mt]) {
      const list = grouped.get(mt) ?? []
      list.push(event)
      grouped.set(mt, list)
    } else {
      noType.push(event)
    }
  }

  const lines: string[] = []

  // 記録済みの食事タイプを表示
  for (const mt of MEAL_TYPES) {
    const items = grouped.get(mt)
    if (items && items.length > 0) {
      lines.push(`## ${MEAL_LABELS[mt]}`)
      for (const event of items) {
        lines.push(formatSingleEvent(event))
      }
    }
  }

  // meal_type未設定の記録
  if (noType.length > 0) {
    lines.push('## その他')
    for (const event of noType) {
      lines.push(formatSingleEvent(event))
    }
  }

  // 未記録の食事タイプを明示
  const missing = MEAL_TYPES.filter(mt => !grouped.has(mt) && mt !== 'snack')
  if (missing.length > 0) {
    const missingLabels = missing.map(mt => MEAL_LABELS[mt]).join('・')
    lines.push('')
    lines.push(`⚠ ${missingLabels}の記録なし（入力忘れの可能性あり。摂取カロリー合計は実際より少ない可能性がある）`)
  }

  return lines.join('\n')
}

function formatSingleEvent(event: DailyNutritionEventRow): string {
  const time = event.consumed_at && event.consumed_at.length >= 16
    ? event.consumed_at.slice(11, 16)
    : '--:--'
  const countLabel = event.count == null || !Number.isFinite(event.count) ? '-' : event.count.toFixed(1)
  const noteLabel = event.note?.trim() ? `, note:${event.note.trim()}` : ''
  return `- ${time} ${event.label} x${countLabel}, kcal:${formatPromptNumber(event.kcal, 1)}, P:${formatPromptNumber(event.protein_g, 1)}g, F:${formatPromptNumber(event.fat_g, 1)}g, C:${formatPromptNumber(event.carbs_g, 1)}g${noteLabel}`
}
```

### 4. `buildHaruSystemPrompt` にルール追加

既存の `# トピック選択` セクションの後に追加:

```typescript
'',
'# 食事データの注意',
'- 食事記録は朝食・昼食・夕食・間食に分類されている',
'- 「記録なし」の食事タイプは入力忘れの可能性がある',
'- 未記録の食事がある場合、摂取カロリーの合計値は過小評価されている可能性がある',
'- 「カロリーが少ない」と指摘する前に、未記録の食事がないか確認すること',
'- 未記録がある場合は「昼食が記録されていないため、実際の摂取量はもう少し多い可能性があります」のように補足する',
```

### 5. ユーザープロンプトのセクション名変更

```typescript
// Before:
'# データ対象日の食事詳細（あれば）',

// After:
'# データ対象日の食事記録',
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/report.ts` | 上記全て |

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

デプロイ後にレポート再生成:
```bash
curl -k -X POST -H "X-Api-Key: <KEY>" -H "Content-Type: application/json" \
  -d '{"date":"2026-03-05","force":true}' \
  "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/report/generate"
```

レポート内容で以下を確認:
- 食事が朝食/昼食/夕食ごとに表示されること
- 未記録の食事タイプについて補足があること
- 「カロリーが少ない」と誤った指摘をしないこと
