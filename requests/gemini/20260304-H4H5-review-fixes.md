# Request: H4/H5 コードレビュー修正（Critical 5件 + Important 7件）

- Date: 2026-03-04
- Owner: Gemini
- Status: `open`
- Phase: H（ハルUX v2）
- Priority: 最高

## 概要

H4/H5実装のコードレビューで発見された修正事項。Critical（仕様未達）を最優先で対応すること。

---

## Critical修正（仕様未達）

### C1: NutrientTable が MECE栄養素の 5/35+ しか表示していない

**ファイル**: `web-app/src/components/NutrientTable.tsx` L24-30

**問題**: detailsに飽和脂肪酸・不飽和脂肪酸・トランス脂肪酸・糖質・食物繊維の5項目しかない。HARU_UX_VISION.md §6 で定義されたビタミン13種・ミネラル13種・その他4種が全て欠落。

**修正**: detailsを以下のカテゴリ別アコーディオンに拡張:

```typescript
const vitaminDetails = [
  { label: 'ビタミンA', val: nutrients.vitamin_a_ug, unit: 'μg' },
  { label: 'ビタミンD', val: nutrients.vitamin_d_ug, unit: 'μg' },
  { label: 'ビタミンE', val: nutrients.vitamin_e_mg, unit: 'mg' },
  { label: 'ビタミンK', val: nutrients.vitamin_k_ug, unit: 'μg' },
  { label: 'ビタミンB1', val: nutrients.vitamin_b1_mg, unit: 'mg' },
  { label: 'ビタミンB2', val: nutrients.vitamin_b2_mg, unit: 'mg' },
  { label: 'ビタミンB6', val: nutrients.vitamin_b6_mg, unit: 'mg' },
  { label: 'ビタミンB12', val: nutrients.vitamin_b12_ug, unit: 'μg' },
  { label: 'ビタミンC', val: nutrients.vitamin_c_mg, unit: 'mg' },
  { label: 'ナイアシン', val: nutrients.niacin_mg, unit: 'mg' },
  { label: '葉酸', val: nutrients.folate_ug, unit: 'μg' },
  { label: 'パントテン酸', val: nutrients.pantothenic_acid_mg, unit: 'mg' },
  { label: 'ビオチン', val: nutrients.biotin_ug, unit: 'μg' },
]

const mineralDetails = [
  { label: 'ナトリウム', val: nutrients.sodium_mg, unit: 'mg' },
  { label: 'カリウム', val: nutrients.potassium_mg, unit: 'mg' },
  { label: 'カルシウム', val: nutrients.calcium_mg, unit: 'mg' },
  { label: 'マグネシウム', val: nutrients.magnesium_mg, unit: 'mg' },
  { label: 'リン', val: nutrients.phosphorus_mg, unit: 'mg' },
  { label: '鉄', val: nutrients.iron_mg, unit: 'mg' },
  { label: '亜鉛', val: nutrients.zinc_mg, unit: 'mg' },
  { label: '銅', val: nutrients.copper_mg, unit: 'mg' },
  { label: 'マンガン', val: nutrients.manganese_mg, unit: 'mg' },
  { label: 'セレン', val: nutrients.selenium_ug, unit: 'μg' },
  { label: 'クロム', val: nutrients.chromium_ug, unit: 'μg' },
  { label: 'モリブデン', val: nutrients.molybdenum_ug, unit: 'μg' },
  { label: 'ヨウ素', val: nutrients.iodine_ug, unit: 'μg' },
]

const otherDetails = [
  { label: 'コレステロール', val: nutrients.cholesterol_mg, unit: 'mg' },
  { label: 'プリン体', val: nutrients.purine_mg, unit: 'mg' },
  { label: 'カフェイン', val: nutrients.caffeine_mg, unit: 'mg' },
  { label: 'アルコール', val: nutrients.alcohol_g, unit: 'g' },
]
```

展開時に「脂質詳細」「ビタミン」「ミネラル」「その他」のカテゴリ見出し付きで表示すること。

### C2: NutrientDetails 型にビタミン・ミネラルフィールドがない

**ファイル**: `web-app/src/api/types.ts` L505-516

**問題**: `NutrientDetails` に `fat_sat_g` 等の脂質詳細しかなく、ビタミン・ミネラルの明示的フィールドがない。`[key: string]: number | null` のindex signatureに頼っているが、型安全性がない。

**修正**: H3のバックエンド `micros_json` スキーマに合わせて全フィールドを明示:

```typescript
export interface NutrientDetails {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  // 脂質詳細
  saturated_fat_g: number | null
  omega3_mg: number | null
  omega6_mg: number | null
  trans_fat_g: number | null
  sugar_g: number | null
  fiber_g: number | null
  // ビタミン
  vitamin_a_ug: number | null
  vitamin_d_ug: number | null
  vitamin_e_mg: number | null
  vitamin_k_ug: number | null
  vitamin_b1_mg: number | null
  vitamin_b2_mg: number | null
  vitamin_b6_mg: number | null
  vitamin_b12_ug: number | null
  vitamin_c_mg: number | null
  niacin_mg: number | null
  folate_ug: number | null
  pantothenic_acid_mg: number | null
  biotin_ug: number | null
  // ミネラル
  sodium_mg: number | null
  potassium_mg: number | null
  calcium_mg: number | null
  magnesium_mg: number | null
  phosphorus_mg: number | null
  iron_mg: number | null
  zinc_mg: number | null
  copper_mg: number | null
  manganese_mg: number | null
  selenium_ug: number | null
  chromium_ug: number | null
  molybdenum_ug: number | null
  iodine_ug: number | null
  // その他
  cholesterol_mg: number | null
  purine_mg: number | null
  caffeine_mg: number | null
  alcohol_g: number | null
}
```

**注意**: 旧フィールド名 `fat_sat_g` / `fat_unsat_g` / `fat_trans_g` はバックエンド（H3）の `saturated_fat_g` / `omega3_mg+omega6_mg` / `trans_fat_g` に合わせてリネームすること。NutrientTableも対応するキー名に更新。

### C3: ハイライトに血圧・カロリーが欠落

**ファイル**: `web-app/src/screens/HomeScreen.tsx` L190-194

**問題**: items配列が睡眠・歩数・体重の3項目のみ。仕様では全ドメイン（血圧・活動カロリー・摂取カロリーも含む）を表示。

**修正**: 以下の項目を追加:

```typescript
const items = [
  { key: 'sleep', label: '睡眠', unit: '時間', val: metrics?.sleep ? (metrics.sleep / 60) : null, avg: averages?.sleep ? (averages.sleep / 60) : null, higherIsBetter: true },
  { key: 'steps', label: '歩数', unit: '歩', val: metrics?.steps, avg: averages?.steps, higherIsBetter: true },
  { key: 'weight', label: '体重', unit: 'kg', val: metrics?.weight, avg: averages?.weight, higherIsBetter: false },
  { key: 'bp', label: '血圧', unit: 'mmHg', val: metrics?.bp_systolic, avg: averages?.bp_systolic, higherIsBetter: false },
  { key: 'active_kcal', label: '消費', unit: 'kcal', val: metrics?.active_kcal, avg: averages?.active_kcal, higherIsBetter: true },
  { key: 'intake_kcal', label: '摂取', unit: 'kcal', val: metrics?.intake_kcal, avg: averages?.intake_kcal, higherIsBetter: false },
]
```

グリッドを `repeat(3, 1fr)` のまま2行表示（6項目）に。`val == null` の項目は非表示のまま。

### C4: テンプレートボタンに onClick がない

**ファイル**: `web-app/src/screens/HomeScreen.tsx` L237

**問題**: `<button>` に `onClick` がなく、テンプレートを選択してもカスタムレポートが生成できない。

**修正**:
1. `CustomReportSection` に `onSelectTemplate` コールバックを追加
2. `reports.ts` に `requestCustomReport(templateId: string)` クライアント関数を追加
3. テンプレート選択時にAPI呼び出し → 結果を履歴に追加して表示

```typescript
// reports.ts に追加
export async function requestCustomReport(templateId: string): Promise<CustomReportHistoryItem> {
  const res = await apiFetch<CustomReportHistoryItem>('/api/custom-report', {
    method: 'POST',
    body: JSON.stringify({ template_id: templateId }),
  })
  return res
}
```

テンプレートリストはハードコードではなく、バックエンドの定数と一致させる:
```typescript
const TEMPLATES = [
  { id: 'weight', label: '体重・体組成' },
  { id: 'sleep', label: '睡眠' },
  { id: 'blood_pressure', label: '血圧' },
  { id: 'activity', label: '運動・活動' },
  { id: 'nutrition', label: '食事・栄養' },
  { id: 'general', label: '総合分析' },
] as const
```

現在の `'最近の疲れの原因は？'` 等の文言ベースリストを上記に置き換え。

### C5: お気に入りがハードコードモック

**ファイル**: `web-app/src/components/FoodInput.tsx` L17

**問題**: `favorites` がハードコードの3件モック。既に `api/food.ts` に `searchFoodFavorites()` が実装済みなのに使っていない。

**修正**: ハードコード配列を削除し、`searchFoodFavorites` API を利用:
- コンポーネントマウント時に `searchFoodFavorites('')` を呼び出して最近の食品を取得
- テキスト入力中は `searchFoodFavorites(query)` でリアルタイム検索
- API結果が空の場合のみ「履歴なし」表示

---

## Important修正

### I1: Immutability違反（直接オブジェクト変更）

**ファイル**: `web-app/src/components/FoodConfirm.tsx` L58-60

**問題**: `newItems[0].amount = e.target.value` — spread で配列コピーしても要素は同じ参照。オブジェクトを直接変更している。

**修正**:
```typescript
onChange={e => {
  setItems(prev => prev.map((item, i) =>
    i === 0 ? { ...item, amount: e.target.value } : item
  ))
}}
```

### I2: トレンド矢印の色がメトリクスの意味を考慮していない

**ファイル**: `web-app/src/screens/HomeScreen.tsx` L196-200

**問題**: 全メトリクスで `▲=赤、▼=青` だが、歩数▲は良いこと（緑）、体重▲は注意（赤）。

**修正**: C3で追加する `higherIsBetter` フラグに基づいて色を反転:
```typescript
const getTrend = (val: number, avg: number, higherIsBetter: boolean) => {
  const isHigher = val > avg * 1.1
  const isLower = val < avg * 0.9
  if (isHigher) return { icon: '▲', color: higherIsBetter ? 'var(--accent-color)' : 'var(--danger-color)' }
  if (isLower) return { icon: '▼', color: higherIsBetter ? 'var(--danger-color)' : 'var(--accent-color)' }
  return { icon: '→', color: 'var(--text-muted)' }
}
```

### I3: FoodConfirm が先頭アイテムのみ表示

**ファイル**: `web-app/src/components/FoodConfirm.tsx` L31

**問題**: `const currentItem = items[0]` で先頭のみ。「すき家 牛丼 + サラダセット」で2品解析された場合、サラダが確認できない。

**修正**: 全アイテムをリスト表示し、各アイテムの分量を編集可能にする。アコーディオンまたは縦リストで全品表示。

### I4: alert() 使用

**ファイル**: `web-app/src/components/FoodConfirm.tsx` L24

**問題**: `alert('保存に失敗しました')` — ネイティブのalert()はモバイルUXに不適切。

**修正**: useState でエラーメッセージを管理し、UI内にインラインエラー表示。

### I5: console.warn 残留

**ファイル**: `web-app/src/api/reports.ts` L10

**問題**: `console.warn('Failed to fetch custom reports history:', err)` がコミットコードに残っている。

**修正**: `console.warn` を削除。エラーは呼び出し元で処理するか、空配列を返すだけで十分。

### I6: お気に入り保存チェックボックスがない

**ファイル**: `web-app/src/components/FoodConfirm.tsx`

**問題**: H3 APIの `save_to_favorites: true` フラグに対応するUIがない。確認画面で「お気に入りに追加」チェックボックスが必要。

**修正**: 各アイテムに「お気に入りに追加」トグルを追加し、`confirmFood` 呼び出し時に `save_to_favorites` フラグを含める。

### I7: confirmFood の引数が H3 API仕様と不一致

**ファイル**: `web-app/src/api/food.ts` L12-17

**問題**: `confirmFood(items, date)` のリクエストボディが `{ items, date }` だが、H3仕様では `{ local_date, consumed_at, items }` で、各itemに `save_to_favorites` フラグがある。

**修正**:
```typescript
export async function confirmFood(
  items: Array<FoodAnalyzeResult & { save_to_favorites?: boolean }>,
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
        micros: item.nutrients,  // MECE全栄養素
        save_to_favorites: item.save_to_favorites ?? false,
      })),
    }),
  })
}
```

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/api/types.ts` | NutrientDetails に全MECE栄養素フィールド追加（C2） |
| `web-app/src/components/NutrientTable.tsx` | ビタミン・ミネラル・その他カテゴリ追加（C1） |
| `web-app/src/screens/HomeScreen.tsx` | ハイライト6項目化（C3）、トレンド色修正（I2）、テンプレートonClick+定数化（C4） |
| `web-app/src/components/FoodInput.tsx` | お気に入りAPI接続（C5） |
| `web-app/src/components/FoodConfirm.tsx` | Immutability修正（I1）、全アイテム表示（I3）、alert除去（I4）、お気に入りチェックボックス（I6） |
| `web-app/src/api/food.ts` | confirmFood引数をH3仕様に合わせる（I7） |
| `web-app/src/api/reports.ts` | requestCustomReport追加（C4）、console.warn除去（I5） |

## Acceptance Criteria

1. NutrientTable で全MECE栄養素（ビタミン13種・ミネラル13種・その他4種）が表示される
2. NutrientDetails 型がバックエンド micros_json スキーマと一致する
3. ハイライトに血圧・消費カロリー・摂取カロリーが表示される（データがある場合）
4. トレンド矢印の色がメトリクスの意味に合っている（歩数▲=緑、体重▲=赤）
5. テンプレートボタンクリックでカスタムレポートAPIが呼ばれる
6. テンプレート名がバックエンド定数と一致している
7. お気に入りがAPIから取得される（ハードコードなし）
8. FoodConfirm で全アイテムが確認・編集できる
9. Immutability違反がない（直接オブジェクト変更なし）
10. alert() / console.warn が除去されている
11. confirmFood がH3 API仕様（local_date, consumed_at, save_to_favorites）に準拠している
12. TypeScript ビルドが通る
