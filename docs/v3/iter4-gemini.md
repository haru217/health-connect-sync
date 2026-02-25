# Iteration 4 — Gemini 用指示書（MealScreen 改修）

## 背景・前提

Health AI Advisor v3 の Iteration 4 です。以下が既に実装済みです：

- `context/DateContext.tsx` — `useDateContext()` で `activeDate` を取得
- `components/DateNavBar.tsx` — 日付ナビバー
- Backend: `/api/nutrition/day` に AI コメントフィールドが追加される（Codex 担当）

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/screens/MealScreen.tsx` | 改修（全面書き換えでOK） |
| `web-app/src/screens/MealScreen.css` | 改修 |
| `web-app/src/api/types.ts` | 型更新 |

---

## 現状の MealScreen について

現行の MealScreen は以下の構成：
- タブ: `食事ログ | サプリ | 栄養素`
- 独自の日付 state を持ち、日付ナビを持つ
- AI 栄養士コメントカードが一番上に表示される

---

## Step 1: types.ts の NutritionDayResponse に ai_comment を追加

```typescript
export interface NutritionDayResponse {
  date: string
  events: NutritionEvent[]
  totals: {
    kcal: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
    micros: Record<string, number>
  }
  ai_comment: string | null    // ← 追加（Codex が実装）
}
```

---

## Step 2: MealScreen.tsx の改修ポイント

### 2-1: 日付管理を DateContext に移行

現行の自前日付 state を削除し、`useDateContext()` を使う：

```typescript
// 削除:
const [selectedDate, setSelectedDate] = useState(todayLocal())
// 追加:
const { activeDate: selectedDate } = useDateContext()
```

`<DateNavBar />` を画面の先頭に追加（自前の日付ナビは削除）。

### 2-2: AI 栄養士コメントカード（既存あり、改善）

現行の AI コメントカードを以下のデザインに更新：

```
┌─────────────────────────────────────────┐
│ 🥗 栄養士からのコメント                  │
├─────────────────────────────────────────┤
│ タンパク質の摂取が少なめです。           │
│ 夕食にチキンや豆腐を追加すると...        │
└─────────────────────────────────────────┘
```

- `nutritionDay.ai_comment` が null の場合はカードを非表示（または「コメントなし」）
- `ai_comment` が空でない場合のみ表示

### 2-3: 食事ログタブの改善

食事アイテムに時間帯アイコンを追加：

```typescript
function mealTimeIcon(consumedAt: string): string {
  const hour = new Date(consumedAt).getHours()
  if (hour >= 5 && hour < 10) return '🌅'   // 朝食
  if (hour >= 10 && hour < 14) return '☀️'  // 昼食
  if (hour >= 14 && hour < 19) return '🌆'  // 夕食
  return '🌙'                                // 夜食・その他
}
```

### 2-4: 栄養素タブのプログレッシブ・ディスクロージャー

現行は全栄養素を一覧表示。以下のように改善：

- **常時表示（5項目）**: カロリー、タンパク質、脂質、炭水化物、食物繊維
- **「もっと見る」ボタン**: 押すと残りの栄養素を展開

```tsx
const PRIMARY_NUTRIENTS = ['energy', 'protein', 'fat', 'carbohydrates', 'dietary_fiber']

const primaryTargets = targets.filter(t => PRIMARY_NUTRIENTS.includes(t.key))
const secondaryTargets = targets.filter(t => !PRIMARY_NUTRIENTS.includes(t.key))

// showAll state で切り替え
```

### 2-5: 栄養素プログレスバーの色分け

現行の色ルールを確認・維持しつつ、見た目を改善：

```typescript
function getBarColor(status: 'green' | 'yellow' | 'red'): string {
  if (status === 'green') return '#16a34a'   // 適正
  if (status === 'yellow') return '#d97706'  // 注意（不足または過多に近い）
  return '#dc2626'                           // 超過または不足
}
```

バー横に状態ラベルも表示：
- `green` → 「適正」
- `yellow` → 不足系ルールなら「不足気味」、超過系なら「多め」
- `red` → 不足系なら「不足」、超過系なら「超過」

---

## Step 3: CSS の更新ポイント

既存の CSS に以下を追加・更新：

```css
/* AI コメントカード */
.meal-ai-card {
  margin: 12px 16px;
  padding: 16px;
  background: linear-gradient(135deg, var(--surface) 0%, #1a2035 100%);
  border-radius: 12px;
  border: 1px solid var(--accent);
  border-left: 3px solid var(--accent);
}
.meal-ai-card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8px;
}
.meal-ai-card-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

/* 食事アイテムのアイコン */
.meal-item-time-icon {
  font-size: 18px;
  margin-right: 10px;
  flex-shrink: 0;
}

/* プログレッシブ・ディスクロージャー */
.show-more-btn {
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
}
.show-more-btn:hover { background: var(--surface-hover); }
```

---

## 注意事項

- `import React from 'react'` を先頭に記述
- **サプリタブの機能は変更しない**（ロジックはそのまま維持）
- `selectedDate` を `useDateContext()` の `activeDate` に置き換えた場合、サプリ・栄養素の `useEffect` も `activeDate` を依存配列に含めること
- `NutritionDayResponse.ai_comment` が API から返らない古いバージョンとの互換性のため、`?.ai_comment` でオプショナルチェーンを使う
