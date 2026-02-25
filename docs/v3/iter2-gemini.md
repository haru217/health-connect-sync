# Iteration 2 — Gemini 用指示書（HealthScreen 全面改修）

## 背景・前提

Health AI Advisor v3 の Iteration 2 です。以下が既に実装済みです：

- `context/DateContext.tsx` — `useDateContext()` で `activeDate` を取得
- `components/DateNavBar.tsx` — 日付ナビバー
- `components/SegmentSelector.tsx` — 週/月/年セグメント（`Segment = 'week' | 'month' | 'year'`）
- Backend: `/api/body-data`, `/api/sleep-data`, `/api/vitals-data` エンドポイント

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/screens/HealthScreen.tsx` | 全面書き換え |
| `web-app/src/screens/HealthScreen.css` | 全面書き換え |
| `web-app/src/api/types.ts` | 型追加 |
| `web-app/src/api/healthApi.ts` | 関数追加 |

---

## Step 1: types.ts に型を追加

```typescript
// ── /api/body-data ──
export interface BodyDataPoint {
  date: string
  weight_kg: number | null
  body_fat_pct: number | null
  bmr_kcal: number | null
}

export interface BodyDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    weight_kg: number | null
    body_fat_pct: number | null
    bmi: number | null
    bmr_kcal: number | null
  }
  goalWeight: number | null
  series: BodyDataPoint[]
}

// ── /api/sleep-data ──
export interface SleepDataPoint {
  date: string
  sleep_minutes: number | null
  deep_min: number | null
  light_min: number | null
  rem_min: number | null
}

export interface SleepDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    sleep_minutes: number | null
    bedtime: string | null
    wake_time: string | null
    avg_spo2: number | null
    min_spo2: number | null
  }
  stages: {
    deep_min: number | null
    light_min: number | null
    rem_min: number | null
  }
  series: SleepDataPoint[]
  periodSummary: {
    avg_sleep_min: number | null
    goal_days: number
  }
}

// ── /api/vitals-data ──
export interface VitalsDataPoint {
  date: string
  systolic: number | null
  diastolic: number | null
  resting_hr: number | null
}

export interface VitalsDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    systolic: number | null
    diastolic: number | null
    resting_hr: number | null
  }
  series: VitalsDataPoint[]
}
```

---

## Step 2: healthApi.ts に関数追加

```typescript
import type { BodyDataResponse, SleepDataResponse, VitalsDataResponse } from './types'

export async function fetchBodyData(date: string, period: string): Promise<BodyDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<BodyDataResponse>(`/api/body-data?${query}`)
}

export async function fetchSleepData(date: string, period: string): Promise<SleepDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<SleepDataResponse>(`/api/sleep-data?${query}`)
}

export async function fetchVitalsData(date: string, period: string): Promise<VitalsDataResponse> {
  const query = new URLSearchParams({ date, period }).toString()
  return apiFetch<VitalsDataResponse>(`/api/vitals-data?${query}`)
}
```

---

## Step 3: HealthScreen.tsx 全面書き換え

### 設計方針

- `useDateContext()` で `activeDate` を取得（自前の日付 state は持たない）
- 内部タブ: `体組成 | バイタル | 睡眠`（ローカル state）
- セグメント: `週 | 月 | 年`（ローカル state、内部タブごとに独立）
- `activeDate` + `segment` が変わるたびに対応 API を再フェッチ
- **Recharts グラフはセグメント別に自動切替**（下記グラフ仕様を参照）

### コンポーネント構成

```tsx
export default function HealthScreen() {
  const { activeDate } = useDateContext()
  const [tab, setTab] = useState<'composition' | 'circulation' | 'sleep'>('composition')
  const [segment, setSegment] = useState<Segment>('week')

  return (
    <div className="health-container">
      <DateNavBar />
      <InnerTabBar tab={tab} onTabChange={setTab} />
      <SegmentSelector value={segment} onChange={setSegment} />
      {tab === 'composition' && <CompositionTab date={activeDate} segment={segment} />}
      {tab === 'circulation' && <CirculationTab date={activeDate} segment={segment} />}
      {tab === 'sleep' && <SleepTab date={activeDate} segment={segment} />}
    </div>
  )
}
```

### InnerTabBar

```
[体組成]  [バイタル]  [睡眠]
```

- アクティブタブにアンダーライン or 背景色
- クラス: `.inner-tab-bar`, `.inner-tab`, `.inner-tab.active`

---

### CompositionTab（体組成）

**データ取得:** `fetchBodyData(date, segment)`

**表示内容:**

1. **現在値カード**
   ```
   体重: 72.3 kg    体脂肪: 18.5%
   BMI: 23.1 標準   目標体重: 68.0 kg
   ```

2. **Recharts グラフ（セグメント別）**

   | セグメント | グラフ種別 | 詳細 |
   |---|---|---|
   | 週・月 | `ComposedChart` | 体重 Line（左 Y軸）+ 体脂肪 Area（右 Y軸） |
   | 年 | `LineChart` | 体重 Line のみ（月別平均） |

   - 目標体重がある場合: `<ReferenceLine y={goalWeight} stroke="#f59e0b" strokeDasharray="4 4" label="目標" />`
   - X軸ラベル: 週=曜日（月火水...）、月=5日ごと（1,5,10,15...）、年=月名（1月,2月...）

3. **週次変化リスト**（週セグメントのみ）
   ```
   今週  -0.5kg / -0.2%
   先週  -0.3kg / -0.1%
   ```
   ※ series の先頭と末尾の差分を計算して表示

---

### CirculationTab（バイタル）

**データ取得:** `fetchVitalsData(date, segment)`

**表示内容:**

1. **現在値カード**
   ```
   血圧: 120/78 mmHg  [正常]
   安静時心拍: 62 bpm  [良好]
   ```
   血圧判定: 収縮期 ≥140 または 拡張期 ≥90 → 「要確認」赤、≥120 or ≥80 → 「注意」黄、それ以外 → 「正常」緑

2. **Recharts グラフ（セグメント別）**

   | セグメント | グラフ種別 | 詳細 |
   |---|---|---|
   | 週 | `BarChart` | 収縮期・拡張期のグループバー |
   | 月 | `LineChart` | 収縮期（赤）+ 拡張期（青）2本線 |
   | 年 | `LineChart` | 収縮期（赤）+ 拡張期（青）2本線 |

   血圧正常範囲の ReferenceLine:
   ```tsx
   <ReferenceLine y={120} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '120', position: 'right', fontSize: 10 }} />
   <ReferenceLine y={80} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '80', position: 'right', fontSize: 10 }} />
   ```

---

### SleepTab（睡眠）

**データ取得:** `fetchSleepData(date, segment)`

**表示内容:**

1. **現在値カード**
   ```
   睡眠: 6時間32分  [やや短め]
   就寝: 23:45   起床: 06:17
   深睡眠: 90分  浅睡眠: 210分  REM: 92分
   SpO2: 平均 97.2%  最低 94.8%
   ```
   睡眠評価: ≥420分 → 「良好」緑、≥360分 → 「やや短め」黄、それ未満 → 「短め」赤

2. **Recharts グラフ（セグメント別）**

   | セグメント | グラフ種別 | 詳細 |
   |---|---|---|
   | 週 | `BarChart` | 睡眠時間（時間単位）、積み上げバー（深/浅/REM） |
   | 月 | `AreaChart` | 睡眠時間の推移 |
   | 年 | `BarChart` | 月別平均睡眠時間 |

   7時間目標の ReferenceLine:
   ```tsx
   <ReferenceLine y={7} stroke="#5b6af0" strokeDasharray="4 4" label={{ value: '目標7h', position: 'insideTopRight', fontSize: 10 }} />
   ```

   ※ グラフの Y軸は分単位のデータを時間単位に変換して表示（`value / 60`）

3. **期間サマリー**
   ```
   平均睡眠: 6時間40分   目標達成日: 4日
   ```

---

### X軸ラベル間引きの実装

```typescript
function formatXLabel(dateStr: string, segment: Segment): string {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
  if (segment === 'week') {
    const [y, m, d] = dateStr.split('-').map(Number)
    return WEEKDAYS[new Date(y, m - 1, d).getDay()]
  }
  if (segment === 'year') {
    // dateStr は 'YYYY-MM' 形式
    return `${parseInt(dateStr.split('-')[1])}月`
  }
  // month: 5日ごとのみ表示
  const day = parseInt(dateStr.split('-')[2])
  return day % 5 === 1 ? `${day}日` : ''
}
```

---

## HealthScreen.css のポイント

```css
/* 内部タブバー */
.inner-tab-bar { display: flex; border-bottom: 1px solid var(--border); }
.inner-tab { flex: 1; padding: 10px 0; text-align: center; font-size: 14px; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; }
.inner-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

/* 現在値カード */
.health-current-card { margin: 12px 16px; padding: 16px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
.health-metric-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
.health-metric-label { font-size: 13px; color: var(--text-secondary); }
.health-metric-value { font-size: 15px; font-weight: 700; color: var(--text-primary); }

/* グラフコンテナ */
.health-chart-container { margin: 0 16px 16px; padding: 16px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); }
.health-chart-title { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 12px; }

/* ステータスバッジ */
.status-badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.status-badge.good { background: #16a34a22; color: #16a34a; }
.status-badge.warning { background: #d9770622; color: #d97706; }
.status-badge.danger { background: #dc262622; color: #dc2626; }
```

---

## 注意事項

- `import React from 'react'` を先頭に記述
- Recharts の `ResponsiveContainer` は `width="100%"` `height={200}` で使う
- データが空（series が []）の場合はグラフの代わりに「データなし」メッセージを表示
- `fetchBodyData` / `fetchSleepData` / `fetchVitalsData` が失敗した場合はエラーカードを表示（クラッシュさせない）
- 既存の `fetchSummary` は使わない（新しい API に完全移行）
