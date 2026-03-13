# Request: Food系フロントエンドUX改善（U3）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（UX改善）
- Depends on: U2（meal_typeバックエンド）
- Priority: 高

## 概要

FoodConfirmの保存UX改善（Issue 5）と、meal typeセレクタ + 食事リストのグループ表示（Issue 3フロント側）を実装する。

## Issue 5: FoodConfirmの保存UX改善

### 変更ファイル: `web-app/src/components/FoodConfirm.tsx`

1. **ヘッダー変更**: 「内容の確認・修正」→「分析結果」+ 品目数サブテキスト
```tsx
<div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
  <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', marginRight: '16px' }}>←</button>
  <div>
    <h2 style={{ fontSize: '18px', margin: 0 }}>分析結果</h2>
    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{items.length}品目</div>
  </div>
</div>
```

2. **保存ボタン変更**: 「この内容で記録」→「✓ 記録を保存する」
```tsx
<button onClick={handleSave} disabled={loading} style={{ flex: 2, ... }}>
  {loading ? '保存中...' : '✓ 記録を保存する'}
</button>
```

3. **保存成功フィードバック**: `showSuccess` ステートを追加。保存成功時に✅成功画面を1秒表示してから `onConfirmSuccess` を呼ぶ。
```tsx
const [showSuccess, setShowSuccess] = useState(false)

const handleSave = async () => {
  setLoading(true)
  setError(null)
  try {
    await confirmFood(items, activeDate, new Date().toISOString())
    setShowSuccess(true)
    setTimeout(() => onConfirmSuccess(), 1000)
  } catch (err) {
    setError('保存に失敗しました。もう一度お試しください。')
  } finally {
    setLoading(false)
  }
}

// レンダリング部に追加（return文の最初に）:
if (showSuccess) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <div style={{ fontSize: '48px' }}>✅</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>記録を保存しました</div>
    </div>
  )
}
```

## Issue 3（フロント側）: meal typeセレクタ + グループ表示

### 変更ファイル: `web-app/src/api/types.ts`

`FoodHistoryItem` に `mealType` を追加:
```typescript
export interface FoodHistoryItem {
  id: string
  name: string
  brand: string | null
  amount: string
  nutrients: NutrientDetails
  eatenAt: string
  mealType: string | null  // 追加
}
```

### 変更ファイル: `web-app/src/api/food.ts`

1. `confirmFood` に `mealType` パラメータ追加:
```typescript
export async function confirmFood(
    items: Array<FoodAnalyzeResult & { save_to_favorites?: boolean; meal_type?: string | null }>,
    localDate: string,
    consumedAt: string,
): Promise<void> {
    await apiFetch<void>('/api/food/confirm', {
        method: 'POST',
        body: JSON.stringify({
            local_date: localDate,
            consumed_at: consumedAt,
            items: items.map(item => ({
                name: item.name,
                brand: item.brand,
                amount: item.amount,
                kcal: item.nutrients.calories,
                protein_g: item.nutrients.protein_g,
                fat_g: item.nutrients.fat_g,
                carbs_g: item.nutrients.carbs_g,
                micros: item.nutrients,
                save_to_favorites: item.save_to_favorites ?? false,
                meal_type: item.meal_type ?? null,
            })),
        })
    })
}
```

2. `fetchFoodHistory` のマッピングに `mealType` 追加:
```typescript
items: (res.items || []).map(item => ({
  // ... 既存フィールド
  mealType: (item as any).meal_type ?? null,
})),
```

### 変更ファイル: `web-app/src/components/FoodConfirm.tsx`

meal typeセレクタを各食品カードに追加:
```typescript
const MEAL_TYPES = [
  { value: 'breakfast', label: '朝食', emoji: '🌅' },
  { value: 'lunch', label: '昼食', emoji: '☀️' },
  { value: 'dinner', label: '夕食', emoji: '🌙' },
  { value: 'snack', label: '間食', emoji: '🍪' },
] as const

// 時刻で自動推薦
function suggestMealType(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 21) return 'dinner'
  return 'snack'
}
```

items stateに `meal_type` を含める:
```typescript
const [items, setItems] = useState<Array<FoodAnalyzeResult & { save_to_favorites?: boolean; meal_type?: string }>>(
    analyzeData.items.map(item => ({ ...item, save_to_favorites: false, meal_type: suggestMealType() }))
)
```

各カードの「分量目安」の上にセレクタを表示:
```tsx
<div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
  {MEAL_TYPES.map(mt => (
    <button key={mt.value}
      onClick={() => setItems(prev => prev.map((it, i) => i === index ? { ...it, meal_type: mt.value } : it))}
      style={{
        flex: 1, padding: '8px 4px', borderRadius: '8px',
        background: item.meal_type === mt.value ? 'var(--accent-color)' : 'var(--bg-color)',
        color: item.meal_type === mt.value ? 'white' : 'var(--text-muted)',
        border: item.meal_type === mt.value ? 'none' : '1px solid var(--border-color)',
        fontSize: '12px', cursor: 'pointer', fontWeight: item.meal_type === mt.value ? 'bold' : 'normal',
      }}>
      {mt.emoji} {mt.label}
    </button>
  ))}
</div>
```

### 変更ファイル: `web-app/src/screens/FoodScreen.tsx`

食事リストを `meal_type` でグループ表示:
```typescript
const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', null] as const
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 朝食',
  lunch: '☀️ 昼食',
  dinner: '🌙 夕食',
  snack: '🍪 間食',
}

// グループ化ロジック
const groupedItems = useMemo(() => {
  if (!items || items.length === 0) return []
  const groups: Array<{ type: string | null; label: string; items: typeof items }> = []
  for (const mealType of MEAL_TYPE_ORDER) {
    const filtered = items.filter(item => (item.mealType ?? null) === mealType)
    if (filtered.length > 0) {
      groups.push({
        type: mealType,
        label: mealType ? MEAL_TYPE_LABELS[mealType] : 'その他',
        items: filtered,
      })
    }
  }
  return groups
}, [items])
```

mealTypeがある場合はグループ表示、ない場合は従来通りフラット表示。

## 変更ファイル一覧

- `web-app/src/api/types.ts` — `FoodHistoryItem` に `mealType` 追加
- `web-app/src/api/food.ts` — `confirmFood` に mealType、`fetchFoodHistory` に mealType マッピング
- `web-app/src/components/FoodConfirm.tsx` — Issue 5 (ヘッダー/ボタン/成功) + Issue 3 (meal type セレクタ)
- `web-app/src/screens/FoodScreen.tsx` — グループ表示

## 検証

```bash
cd web-app && npx tsc --noEmit
```
