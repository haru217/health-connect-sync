# Request: 食事meal_typeバックエンド対応（U2）

- Date: 2026-03-05
- Owner: Codex
- Status: `pending`
- Phase: U（UX改善）
- Depends on: なし
- Priority: 高

## 概要

食事の朝昼夜の区分け機能のバックエンド部分。DBに `meal_type` カラムを追加し、confirm/history APIで対応する。

## DBマイグレーション

新規ファイル `cloudflare-api/migrations/0014_meal_type.sql`:
```sql
ALTER TABLE nutrition_events ADD COLUMN meal_type TEXT;
```

`meal_type` は NULL許容で後方互換性を維持。値は `'breakfast' | 'lunch' | 'dinner' | 'snack' | null`。

## 型定義の修正

`cloudflare-api/src/types.ts` の `NutritionEventRow` に追加:
```typescript
export interface NutritionEventRow {
  // ... 既存フィールド
  meal_type: string | null  // 追加
}
```

## API修正

### `cloudflare-api/src/handlers/food.ts`

#### handleFoodConfirm

1. `ConfirmFoodItem` インターフェースに `meal_type` を追加:
```typescript
interface ConfirmFoodItem extends FoodItemNormalized {
  save_to_favorites: boolean
  meal_type: string | null  // 追加
}
```

2. `normalizeConfirmFoodItem` で `meal_type` を読み取り:
```typescript
function normalizeConfirmFoodItem(input: unknown): ConfirmFoodItem {
  const normalized = normalizeFoodItem(input)
  const item = input as Record<string, unknown>
  const save_to_favorites = item.save_to_favorites === true
  const mealTypeRaw = typeof item.meal_type === 'string' ? item.meal_type.trim() : null
  const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
  const meal_type = mealTypeRaw && VALID_MEAL_TYPES.includes(mealTypeRaw) ? mealTypeRaw : null
  return { ...normalized, save_to_favorites, meal_type }
}
```

3. INSERT文に `meal_type` を追加:
```sql
INSERT INTO nutrition_events(
  consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note, meal_type
) VALUES(?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?)
```
パラメータの末尾に `item.meal_type` を追加。

#### handleFoodHistory

SELECTに `meal_type` を追加:
```sql
SELECT
  id, consumed_at, local_date, alias, label, count, unit,
  kcal, protein_g, fat_g, carbs_g, micros_json, note, meal_type
FROM nutrition_events
WHERE local_date = ?
ORDER BY consumed_at DESC, id DESC
```

レスポンスマッピングに `meal_type` を追加:
```typescript
items: rows.map((row) => ({
  // ... 既存フィールド
  meal_type: row.meal_type,
})),
```

## 変更ファイル

- `cloudflare-api/migrations/0014_meal_type.sql` — 新規
- `cloudflare-api/src/types.ts` — `NutritionEventRow` に `meal_type` 追加
- `cloudflare-api/src/handlers/food.ts` — confirm/history に meal_type 対応

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```
