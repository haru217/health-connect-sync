# Request: 食事タブUX改善 — あすけん方式（U4）

- Date: 2026-03-05
- Owner: Gemini
- Status: `pending`
- Phase: U（UX改善）
- Depends on: codex-shinsekai U4（DELETE/PUT API）完了済み
- Priority: 高

## 概要

食事タブのUXをあすけん風に全面改善する。2つの変更を実施:
1. **検索ファーストUX**: お気に入りタップで即確認画面へ（API不要）
2. **編集・削除**: 記録済みリストからタップで編集/削除

**レポート生成ボタンは不要。実装しないこと。**

---

## あすけん方式の基本フロー

```
[食事タブ] → [＋記録] → [検索入力]
                          ↓ 文字入力すると…
                        [DB候補リスト] → タップ → [確認画面] → [保存]
                          ↓ 候補がなければ…
                        [AI解析ボタン] → Gemini呼び出し → [確認画面] → [保存]

[食事タブ] → [記録済みアイテムをタップ] → [編集モーダル] → [保存/削除]
```

ポイント:
- **DB候補をタップしたらAPI呼び出しなしで即確認画面へ**
- AI解析はDB候補がない時の補助手段
- 記録済みアイテムはタップで編集可能

---

## Feature 1: 検索ファーストUX

### ファイル: `web-app/src/components/FoodInput.tsx`

#### 現状の問題（L95）
```tsx
// お気に入りクリック時にAPI解析を呼んでいる（無駄）
onClick={() => { setText(fav.name); handleAnalyze(fav.name); }}
```

#### 修正
お気に入り（DB候補）タップ時はAPIを呼ばず、データをそのまま確認画面に渡す:
```tsx
onClick={() => {
  onAnalyzeSuccess({ items: [fav] })
}}
```

#### DB候補リストの表示改善
各候補にカロリーとPFCを表示して選びやすくする:
```tsx
{favorites.map(fav => (
  <button
    key={fav.id || fav.name}
    onClick={() => onAnalyzeSuccess({ items: [fav] })}
    style={{ textAlign: 'left', padding: '14px', background: 'var(--surface)', borderRadius: '12px', border: 'none', fontSize: '15px', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 'bold' }}>{fav.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {fav.amount} · {fav.brand || '一般'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
          {fav.nutrients.calories?.toFixed(0) || '?'} kcal
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          P{fav.nutrients.protein_g?.toFixed(0) || '?'}
          F{fav.nutrients.fat_g?.toFixed(0) || '?'}
          C{fav.nutrients.carbs_g?.toFixed(0) || '?'}
        </div>
      </div>
    </div>
  </button>
))}
```

#### セクション見出しの変更
- 「よく食べる食事から選択」→ 入力テキストが空の場合: **「よく使う食品」**
- 入力テキストがある場合: **「候補」**（検索結果の意味）

#### AI解析ボタンの位置
- テキスト入力欄の横の「解析」ボタンは残す
- 候補が0件の場合、候補リストの位置に「AIで栄養を調べる」大ボタンを表示:
```tsx
{favorites.length === 0 && text.trim() ? (
  <button onClick={() => handleAnalyze(text)}
    style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold' }}>
    AIで栄養を調べる
  </button>
) : null}
```

---

## Feature 2: 食事の編集・削除

### ファイル: `web-app/src/screens/FoodScreen.tsx`

#### 2-1. 記録済みアイテムをタップ可能にする

各アイテムに `onClick` と右端に「>」シェブロンを追加:
```tsx
<div
  key={item.id}
  onClick={() => handleItemClick(item)}
  style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer' }}
>
  {/* 既存の内容 */}
</div>
```

#### 2-2. 編集モーダル

必要なstate:
```typescript
import { deleteFood, updateFood } from '../api/food'

const [editingItem, setEditingItem] = useState<typeof items[0] | null>(null)
const [editForm, setEditForm] = useState({
  name: '', amount: '', kcal: '', protein_g: '', fat_g: '', carbs_g: '', meal_type: null as string | null
})
const [editLoading, setEditLoading] = useState(false)
const [deleteConfirm, setDeleteConfirm] = useState(false)
```

handleItemClick:
```typescript
const handleItemClick = (item: typeof items[0]) => {
  setEditingItem(item)
  setEditForm({
    name: item.name,
    amount: item.amount,
    kcal: String(item.nutrients.calories ?? 0),
    protein_g: String(item.nutrients.protein_g ?? 0),
    fat_g: String(item.nutrients.fat_g ?? 0),
    carbs_g: String(item.nutrients.carbs_g ?? 0),
    meal_type: item.mealType ?? null,
  })
  setDeleteConfirm(false)
}
```

保存:
```typescript
const handleEditSave = async () => {
  if (!editingItem) return
  setEditLoading(true)
  try {
    await updateFood(editingItem.id, {
      name: editForm.name,
      amount: editForm.amount,
      kcal: Number(editForm.kcal),
      protein_g: Number(editForm.protein_g),
      fat_g: Number(editForm.fat_g),
      carbs_g: Number(editForm.carbs_g),
      meal_type: editForm.meal_type,
    })
    setEditingItem(null)
    await loadHistory()
  } catch {
    // エラーハンドリング
  } finally {
    setEditLoading(false)
  }
}
```

削除（確認ダイアログ付き）:
```typescript
const handleDelete = async () => {
  if (!editingItem) return
  setEditLoading(true)
  try {
    await deleteFood(editingItem.id)
    setEditingItem(null)
    await loadHistory()
  } catch {
    // エラーハンドリング
  } finally {
    setEditLoading(false)
  }
}
```

#### 2-3. モーダルのレイアウト

```
┌─────────────────────────────┐
│ ✕                 食事を編集  │
│─────────────────────────────│
│ 食事タイプ                    │
│ [朝食] [昼食] [夕食] [間食]   │
│                               │
│ 名前     [___________________]│
│ 分量     [___________________]│
│ カロリー  [_______] kcal      │
│ タンパク質 [_______] g        │
│ 脂質     [_______] g         │
│ 炭水化物  [_______] g        │
│                               │
│ [────── 保存する ──────]      │
│                               │
│ [削除する]  ← 赤テキスト       │
│                               │
│ 「本当に削除しますか？」       │  ← deleteConfirm時のみ表示
│ [削除する(赤)] [キャンセル]    │
└─────────────────────────────┘
```

- オーバーレイ: `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000`
- モーダル本体: `position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-radius: 16px 16px 0 0; padding: 24px; max-height: 85vh; overflow-y: auto`
- フォームは `<input type="number">` で数値入力（kcal, P, F, C）
- meal_typeは4つのトグルボタン

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/components/FoodInput.tsx` | 検索ファーストUX（お気に入り直接選択、候補表示改善）|
| `web-app/src/screens/FoodScreen.tsx` | 編集モーダル + 削除機能 |

**変更しないファイル**: `HomeScreen.tsx`（レポート生成ボタンは不要）

## 検証

```bash
cd web-app && npx tsc --noEmit
npm run build
```

## デザインガイドライン

- 既存のCSS変数を使用（`--surface`, `--accent-color`, `--text-muted`, `--border-color`等）
- border-radius: 12-16px
- 最小タッチターゲット: 44px
- モーダルはボトムシート方式（モバイルファースト）
- 削除ボタンは `color: var(--danger-color, #dc2626)`
