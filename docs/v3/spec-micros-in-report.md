# 仕様: はるレポートへの微量栄養素データ追加

**ステータス**: CEO承認済み（2026-03-18）
**担当**: Codex
**対象ファイル**: `cloudflare-api/src/handlers/report.ts`

## 背景

現在、はるのデイリーレポートは基本マクロ（kcal/P/F/C）しかLLMに渡していない。
`nutrition_events.micros_json` にビタミン・ミネラルが格納されていても、プロンプトに含まれないため、はるは「リンが多いから〇〇を摂ったほうがいい」のようなアドバイスができない。

## 方針

- **保存**: 全栄養素（変更なし、既にmicros_jsonで対応済み）
- **表示**: 主要なもの（Android UIの話、この仕様のスコープ外）
- **レポート**: 全部LLMに渡してはるに判断させる

## 変更箇所（report.ts のみ）

### 1. DailyNutritionEventRow に micros_json を追加

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
  meal_type: string | null
  micros_json: string | null  // ← 追加
}
```

### 2. queryDailyNutritionEvents に micros_json を追加

```sql
SELECT
  consumed_at, label, count, kcal, protein_g, fat_g, carbs_g,
  note, meal_type, micros_json
FROM nutrition_events
WHERE local_date = ?
ORDER BY consumed_at ASC, id ASC
```

### 3. formatSingleEvent で micros を追加

`parseMicros(event.micros_json)` を使い、値が非null・非0の微量栄養素をプロンプトに含める。

```typescript
// 例: formatSingleEvent の出力イメージ
// - 12:30 白米 x1.0, kcal:235, P:4.0g, F:0.5g, C:52.0g
//   micros: fiber:0.5g, phosphorus:68mg, potassium:46mg, ...
```

フォーマット方針:
- 非null・非0の項目のみ出力
- マクロ行の次行にインデントして `micros: key:value, ...` 形式
- micros が全てnull/0なら micros 行を省略

### 4. はるのシステムプロンプトに微量栄養素指示を追加

`buildHaruSystemPrompt` の `baseRules` に以下を追加:

```
- 食事データに微量栄養素（ビタミン・ミネラル）がある場合、不足や過剰に気づいたら具体的にアドバイスする（例: 「鉄分が不足気味なので〇〇がおすすめ」「リンの摂取が多めなので△△を意識して」）
- 微量栄養素のアドバイスは1日の合計値を見て判断する。個別の食品ごとに言及しない
```

## 変更しないもの

- DBスキーマ（micros_json は既存）
- queryDailyReportTrendRows（14日トレンド表はマクロのみで十分）
- food.ts, nutrition.ts（既に micros_json を正しく扱っている）
- マイグレーション不要

## トークンコスト影響

- 1食品あたり micros 行 +50〜100トークン
- 1日5食品 × 100tok = +500tok/レポート
- Claude Haiku: +500tok × ¥0.00012 = +¥0.06/レポート（誤差の範囲）

## テスト

- micros_json が null の食品 → micros 行が出力されないことを確認
- micros_json がある食品 → 非null/非0項目のみ出力されることを確認
- はるのレポートで微量栄養素へのアドバイスが含まれることを確認（手動）
