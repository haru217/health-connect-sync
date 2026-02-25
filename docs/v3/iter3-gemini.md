# Iteration 3 — Gemini 用指示書（ExerciseScreen 全面改修）

## 背景・前提

Health AI Advisor v3 の Iteration 3 です。以下が既に実装済みです：

- `context/DateContext.tsx` — `useDateContext()` で `activeDate` を取得
- `components/DateNavBar.tsx` — 日付ナビバー
- `components/SegmentSelector.tsx` — 週/月/年セグメント
- Backend: `/api/activity-data?date=YYYY-MM-DD&period=week|month|year`

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/screens/ExerciseScreen.tsx` | 全面書き換え |
| `web-app/src/screens/ExerciseScreen.css` | 全面書き換え |
| `web-app/src/api/types.ts` | 型追加 |
| `web-app/src/api/healthApi.ts` | 関数追加 |

---

## Step 1: types.ts に型追加

```typescript
export interface ActivityDataPoint {
  date: string
  steps: number | null
  active_kcal: number | null
}

export interface ExerciseItem {
  date: string
  type: number
  title: string
  duration_min: number | null
  distance_km: number | null
}

export interface ActivityDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    steps: number | null
    active_kcal: number | null
    total_kcal: number | null
    distance_km: number | null
  }
  series: ActivityDataPoint[]
  exercises: ExerciseItem[]
}
```

---

## Step 2: healthApi.ts に関数追加

```typescript
export async function fetchActivityData(date: string, period: string): Promise<ActivityDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<ActivityDataResponse>(`/api/activity-data?${query}`)
}
```

---

## Step 3: ExerciseScreen.tsx 全面書き換え

### 設計方針

- **フラット構成**（内部タブなし）
- `useDateContext()` で `activeDate` を取得
- セグメント（週/月/年）でグラフと期間サマリーが切り替わる
- ワークアウト一覧は `activeDate` の期間（週セグメント時は直近7日）で表示

### コンポーネント構成

```tsx
export default function ExerciseScreen() {
  const { activeDate } = useDateContext()
  const [segment, setSegment] = useState<Segment>('week')
  const [state, setState] = useState<RequestState<ActivityDataResponse>>({ status: 'loading' })

  useEffect(() => {
    // fetchActivityData(activeDate, segment) を呼ぶ
  }, [activeDate, segment])

  return (
    <div className="exercise-container">
      <DateNavBar />
      <SegmentSelector value={segment} onChange={setSegment} />
      {/* 当日サマリーカード */}
      <CurrentSummaryCard current={data.current} />
      {/* 歩数グラフ */}
      <StepsChart series={data.series} segment={segment} />
      {/* カロリーグラフ */}
      <CaloriesChart series={data.series} segment={segment} />
      {/* ワークアウト一覧 */}
      <WorkoutList exercises={data.exercises} />
      {/* 期間サマリー */}
      <PeriodSummaryCard series={data.series} segment={segment} />
    </div>
  )
}
```

---

### CurrentSummaryCard（当日サマリー）

```
┌──────────────────────────────────────────┐
│  👟 8,234歩     🔥 350kcal              │
│  📏 5.2km       🏃 2,150kcal（総消費）  │
└──────────────────────────────────────────┘
```

- 4項目を2×2グリッドで表示
- データがない場合は `--` 表示

---

### StepsChart（歩数グラフ）

**セグメント別:**

| セグメント | グラフ | X軸ラベル |
|---|---|---|
| 週 | `BarChart` | 曜日（月火水...） |
| 月 | `BarChart` | 5日ごと（1,5,10...） |
| 年 | `BarChart` | 月名（1月,2月...） |

- バーの色: デフォルト `var(--accent, #5b6af0)`
- 目標 10,000 歩の ReferenceLine:
  ```tsx
  <ReferenceLine y={10000} stroke="#f59e0b" strokeDasharray="4 4" />
  ```
- タップしたバーをハイライト（`Cell` で選択中のバーの色を変える）
- タップ時に選択日の値を下部に表示

---

### CaloriesChart（カロリーグラフ）

**セグメント別:**

| セグメント | グラフ | 系列 |
|---|---|---|
| 週 | `LineChart` | 活動カロリー（赤）+ 総消費カロリー（オレンジ）|
| 月 | `LineChart` | 活動カロリー（赤）|
| 年 | `BarChart` | 月別平均活動カロリー |

- データは `series` の `active_kcal`

---

### WorkoutList（ワークアウト一覧）

`exercises` 配列を日付の降順で表示（最大 10件）。

```
┌──────────────────────────────────────┐
│ 🏃 ランニング          02/25        │
│    30分  ·  3.2km                   │
├──────────────────────────────────────┤
│ 💪 ウェイトトレーニング  02/24        │
│    45分                             │
└──────────────────────────────────────┘
```

- exercises が空の場合は「この期間のワークアウトはありません」
- アイコンは exercise type 番号で分岐：
  ```typescript
  function exerciseIcon(type: number): string {
    if ([35, 52, 87].includes(type)) return '🏃'  // ランニング・歩行
    if ([8].includes(type)) return '🚴'            // サイクリング
    if ([47, 53].includes(type)) return '🏊'       // 水泳
    if ([54, 64, 81].includes(type)) return '💪'   // ウェイト・HIIT
    if ([55, 32].includes(type)) return '🧘'       // ヨガ・ピラティス
    return '🏅'                                    // その他
  }
  ```

---

### PeriodSummaryCard（期間サマリー）

```
【週サマリー】
平均歩数: 7,500歩/日   合計活動: 2,450kcal
```

- 週: series の平均歩数・合計活動カロリーを計算して表示
- 月: 同様に月の集計
- 年: 年の集計

計算はクライアント側で `series` から算出：
```typescript
const avgSteps = series.length > 0
  ? Math.round(series.reduce((sum, p) => sum + (p.steps ?? 0), 0) / series.length)
  : null
const totalActiveKcal = series.reduce((sum, p) => sum + (p.active_kcal ?? 0), 0)
```

---

## ExerciseScreen.css のポイント

```css
.exercise-container { padding-bottom: 80px; }

/* 当日サマリー */
.exercise-current-card { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 16px; padding: 16px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
.exercise-metric { display: flex; flex-direction: column; gap: 4px; }
.exercise-metric-label { font-size: 12px; color: var(--text-muted); }
.exercise-metric-value { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.exercise-metric-unit { font-size: 12px; color: var(--text-secondary); margin-left: 2px; }

/* グラフカード */
.exercise-chart-card { margin: 0 16px 12px; padding: 16px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
.exercise-chart-title { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 12px; }

/* ワークアウトリスト */
.workout-list-card { margin: 0 16px 12px; }
.workout-list-title { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
.workout-item { display: flex; align-items: flex-start; padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
.workout-icon { font-size: 20px; margin-right: 12px; }
.workout-info { flex: 1; }
.workout-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.workout-meta { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.workout-date { font-size: 12px; color: var(--text-muted); }

/* 期間サマリー */
.period-summary-card { margin: 0 16px 12px; padding: 16px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
```

---

## 注意事項

- `import React from 'react'` を先頭に記述
- `activeDate` と `segment` の両方が変わったときにデータを再フェッチする（`useEffect` の依存配列に両方を含める）
- グラフの Y軸は `tickFormatter` で `toLocaleString('ja-JP')` を使うと大きな数値が読みやすい
- Recharts の `ResponsiveContainer` は `width="100%"` `height={180}` を推奨
