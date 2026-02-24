# Iteration 1 — Gemini 用指示書（HomeScreen.tsx 全面改修）

## 背景・前提

Health AI Advisor v3 の Iteration 1 です。Iteration 0 で以下が既に実装済みです：

- `web-app/src/context/DateContext.tsx` — グローバル日付 Context（`useDateContext()` フック）
- `web-app/src/components/DateNavBar.tsx` — 日付ナビバー（← / 日付ラベル / →）
- `web-app/src/components/SegmentSelector.tsx` — 週/月/年セレクター

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/screens/HomeScreen.tsx` | 全面書き換え |
| `web-app/src/screens/HomeScreen.css` | 全面書き換え |
| `web-app/src/api/types.ts` | 型追加（末尾に追記） |
| `web-app/src/api/healthApi.ts` | 関数追加（末尾に追記） |
| `web-app/src/App.tsx` | HomeScreen への props 追加 |

---

## Step 1: types.ts に型を追加（末尾に追記）

```typescript
export interface HomeSufficiency {
  sleep: boolean
  steps: boolean
  weight: boolean
  meal: boolean
}

export interface HomeEvidence {
  type: string
  label: string
  value: string
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: string
}

export interface HomeSummaryResponse {
  date: string
  report: { content: string; created_at: string } | null
  sufficiency: HomeSufficiency
  evidences: HomeEvidence[]
}
```

---

## Step 2: healthApi.ts に関数を追加（末尾に追記）

```typescript
export async function fetchHomeSummary(date: string): Promise<HomeSummaryResponse> {
  const query = new URLSearchParams({ date }).toString()
  return apiFetch<HomeSummaryResponse>(`/api/home-summary?${query}`)
}
```

import 側に `HomeSummaryResponse` を追加することも忘れずに。

---

## Step 3: App.tsx の修正

`HomeScreen` に `onNavigate` props を渡すよう変更：

```tsx
// renderScreen() の case 'home':
case 'home':
  return <HomeScreen onNavigate={setCurrentScreen} />
```

`ScreenType` は既に `'home' | 'meal' | 'exercise' | 'health' | 'my'` になっています。

---

## Step 4: HomeScreen.tsx 全面書き換え

### 設計方針

- **自前の日付 state を持たない**。`useDateContext()` の `activeDate` を使う
- `activeDate` が変わるたびに `/api/home-summary?date=activeDate` を再フェッチ
- AI レポートのパース：`content` フィールドから HTML コメントでセクション抽出

### Props

```typescript
interface HomeScreenProps {
  onNavigate: (tab: 'home' | 'health' | 'exercise' | 'meal' | 'my') => void
}
```

### 3ステート設計（Graceful Degradation）

| ステート | 条件 | 表示内容 |
|---|---|---|
| **A（Full）** | `report != null` | AI 3者カード（アコーディオン） + 根拠データ |
| **B（Data）** | `report == null` かつ sufficiency が1つ以上 true | データあり + AI未生成メッセージ + 根拠データ |
| **C（Empty）** | sufficiency が全て false | 同期を促すメッセージ |

### コンポーネント構成（擬似コード）

```tsx
export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeSummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    // activeDate が変わるたびに fetchHomeSummary(activeDate) を呼ぶ
    // エラー時は空の HomeSummaryResponse にフォールバック（クラッシュさせない）
  }, [activeDate])

  return (
    <div className="home-container">
      <DateNavBar />
      {state.status === 'loading' && <LoadingSkeleton />}
      {state.status !== 'loading' && (
        <>
          <SufficiencyBar sufficiency={data.sufficiency} />
          {/* ステート A */}
          {data.report && <AiAdvisorSection content={data.report.content} />}
          {/* ステート B */}
          {!data.report && hasSomeData && <NoReportCard />}
          {/* ステート C */}
          {!hasSomeData && <EmptyState />}
          {/* 根拠データ（A・B 共通） */}
          {data.evidences.length > 0 && (
            <EvidenceList evidences={data.evidences} onNavigate={onNavigate} />
          )}
        </>
      )}
    </div>
  )
}
```

### SufficiencyBar

```tsx
// 表示例：● 睡眠  ● 歩数  ○ 体重  ● 食事
// ● = データあり（--accent 色）、○ = データなし（グレー）
const ITEMS = [
  { key: 'sleep', label: '睡眠' },
  { key: 'steps', label: '歩数' },
  { key: 'weight', label: '体重' },
  { key: 'meal', label: '食事' },
] as const
```

### AiAdvisorSection（AI 3者カード、アコーディオン）

**レポートのパース方法：**
```typescript
function extractAgentSections(content: string): {
  doctor: string | null
  trainer: string | null
  nutritionist: string | null
} {
  const extract = (tag: string) => {
    const m = content.match(new RegExp(`<!--${tag}-->([\\s\\S]*?)<!--/${tag}-->`, 'i'))
    return m ? m[1].trim() : null
  }
  return {
    doctor: extract('DOCTOR'),
    trainer: extract('TRAINER'),
    nutritionist: extract('NUTRITIONIST'),
  }
}
```

タグが1つも見つからない場合は `content` 全体を医師カードに表示。

**カードデザイン：**

```
┌─────────────────────────────────────┐
│ 🩺 Dr. 医師          ▼（展開中）    │
├─────────────────────────────────────┤
│ レポート本文テキスト...              │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 💪 トレーナー        ›（折りたたみ） │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 🥗 栄養士            ›              │
└─────────────────────────────────────┘
```

- アイコン: 医師=🩺、トレーナー=💪、栄養士=🥗
- デフォルトは最初のカード（医師）のみ展開
- タップでアコーディオン切り替え（他を閉じる必要はない、独立トグル）

### NoReportCard（ステート B）

```
┌─────────────────────────────────────┐
│ 📋 AIレポートはまだありません         │
│ 今日のデータが揃ったら               │
│ AIプロンプトでレポートを生成できます  │
└─────────────────────────────────────┘
```

### EmptyState（ステート C）

```
┌─────────────────────────────────────┐
│ 📱 データがありません                 │
│ Android アプリから同期してください   │
└─────────────────────────────────────┘
```

### EvidenceList（根拠データ）

```
📊 根拠データ
┌──────────────────────────────────────┐
│ 😴 睡眠        6時間32分         ›   │
│ 👟 歩数        3,200歩           ›   │
│ ⚖️ 体重        72.3kg            ›   │
│ 🍽️ 食事        3件              ›   │
└──────────────────────────────────────┘
```

- 各行タップで `onNavigate(evidence.tab)` を呼ぶ
- 右端に `›` 矢印
- type ごとのアイコン: `sleep`=😴, `steps`=👟, `weight`=⚖️, `meal`=🍽️

---

## Step 5: HomeScreen.css

既存の CSS を刷新。定義が必要な主なクラス：

```css
.home-container { /* padding, max-width */ }

/* SufficiencyBar */
.home-sufficiency-bar { display: flex; gap: 16px; padding: 12px 16px; }
.sufficiency-dot { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.sufficiency-dot::before { content: '●'; }
.sufficiency-dot.on::before { color: var(--accent, #5b6af0); }
.sufficiency-dot.off::before { color: var(--text-muted, #4a5068); }

/* AiAdvisorSection */
.ai-advisor-section { display: flex; flex-direction: column; gap: 8px; padding: 0 16px; }
.ai-advisor-card { background: var(--surface, #1e2028); border-radius: 12px; overflow: hidden; border: 1px solid var(--border, #2a2d3a); }
.ai-card-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; }
.ai-card-title { font-size: 15px; font-weight: 600; color: var(--text-primary, #e8eaf0); }
.ai-card-chevron { color: var(--text-muted, #4a5068); transition: transform 0.2s; }
.ai-card-chevron.open { transform: rotate(90deg); }
.ai-card-body { padding: 0 16px 16px; font-size: 14px; line-height: 1.7; color: var(--text-secondary, #8b90a7); white-space: pre-wrap; }

/* NoReportCard / EmptyState */
.home-no-report-card, .home-empty-state {
  margin: 16px;
  padding: 20px;
  background: var(--surface, #1e2028);
  border-radius: 12px;
  border: 1px solid var(--border, #2a2d3a);
  text-align: center;
  color: var(--text-secondary, #8b90a7);
}

/* EvidenceList */
.evidence-section { margin: 0 16px 16px; }
.evidence-section-title { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
.evidence-list { background: var(--surface, #1e2028); border-radius: 12px; overflow: hidden; border: 1px solid var(--border, #2a2d3a); }
.evidence-item { display: flex; align-items: center; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border, #2a2d3a); }
.evidence-item:last-child { border-bottom: none; }
.evidence-item:hover { background: var(--surface-hover, #2a2d3a); }
.evidence-icon { font-size: 18px; margin-right: 12px; }
.evidence-label { flex: 1; font-size: 14px; color: var(--text-secondary); }
.evidence-value { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-right: 8px; }
.evidence-arrow { color: var(--text-muted); }
```

---

## 注意事項

- `import React from 'react'` を先頭に記述
- `import type { ... }` を使う（型のみのインポート）
- CSS 変数 `--surface`, `--accent`, `--text-primary`, `--border` などは `App.css` で定義済みなので新規定義不要
- `fetchHomeSummary` が失敗した場合（サーバー未起動など）は `{ sufficiency: all false, report: null, evidences: [] }` としてフォールバック
- API の `tab` フィールドの値（`'health'`, `'exercise'` など）は `ScreenType` と一致させること
