# Iteration 1b — Gemini 用指示書（ホームタブ リデザイン）

## 背景

Codex が `/api/home-summary` の実装を完了しました。実際のレスポンス構造を確認したうえで、フロントエンドを実装してください。

### 実際のバックエンドレスポンス構造

```json
{
  "date": "2026-02-25",
  "report": null,
  "sufficiency": { "sleep": true, "steps": true, "weight": true, "meal": false, "bp": true },
  "statusItems": [
    { "key": "sleep", "label": "睡眠", "value": "6h32m", "ok": true, "tab": "health", "innerTab": "sleep", "tone": "normal" },
    { "key": "steps", "label": "歩数", "value": "3,200", "ok": true, "tab": "exercise", "tone": "normal" },
    { "key": "meal",  "label": "食事", "value": null,    "ok": false, "tab": "meal",    "tone": "normal" },
    { "key": "weight","label": "体重", "value": "72.3kg","ok": true, "tab": "health", "innerTab": "composition", "tone": "normal" },
    { "key": "bp",    "label": "BP",   "value": "120/78","ok": true, "tab": "health", "innerTab": "vital",       "tone": "normal" }
  ],
  "attentionPoints": [
    {
      "id": "sleep-deficit-3d-2026-02-25",
      "icon": "⚠️",
      "message": "睡眠不足が3日連続しています",
      "severity": "warning",
      "category": "trend",
      "navigateTo": { "tab": "health", "subTab": "sleep" },
      "dataSource": "sleep"
    }
  ],
  "previousReport": { "date": "2026-02-24", "created_at": "..." },
  "evidences": [...]
}
```

**注意点:**
- BP の `statusItems` への追加は血圧デバイスが連携されている場合のみ（`tone: "warning"` の場合は警告色で表示）
- `attentionPoints` はキャメルケース（`attention_points` ではない）
- `evidences` は後方互換用に残っているが、新UIでは使わない

### types.ts の修正が必要

現在の `types.ts` はバックエンドと一致していません。以下の修正が必要です：

```typescript
// 追加: HealthStatusBar 用
export interface HomeStatusItem {
  key: string
  label: string
  value: string | null
  ok: boolean
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: string
  tone: 'normal' | 'warning' | 'danger'
}

// 修正: HomeSufficiency はシンプルなboolマップに戻す
export interface HomeSufficiency {
  sleep: boolean
  steps: boolean
  weight: boolean
  meal: boolean
  bp?: boolean
}

// 修正: HomeSummaryResponse を実際のレスポンスに合わせる
export interface HomeSummaryResponse {
  date: string
  report: { content: string; created_at: string } | null
  sufficiency: HomeSufficiency
  statusItems?: HomeStatusItem[]
  attentionPoints?: AttentionPoint[]
  previousReport?: { date: string; created_at: string } | null
  evidences?: HomeEvidence[]  // 後方互換用、新UIでは使わない
}

// AttentionPoint の navigateTo を実際のレスポンスに合わせる
export interface AttentionPoint {
  id: string
  icon: string
  message: string
  severity: 'critical' | 'warning' | 'info' | 'positive'
  category?: 'threshold' | 'trend' | 'achievement'
  navigateTo?: {
    tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
    subTab?: string
  }
  dataSource?: string
}
```

`HomeEvidence` は後方互換のため削除せず残してください。

---

`healthApi.ts` と `HomeScreen.tsx` がまだ旧型（`evidences`）を参照しているため、**TypeScript エラーが出ている状態**です。上記の型修正と合わせて解消してください。

---

## デザインシステム（必ず使うこと）

このアプリはライトテーマ（パステルグリーン系）です。CSS変数は以下の通りです：

```
--bg-color: #F9FDF5          /* ページ背景 */
--surface-color: #FFFFFF     /* カード背景 */
--accent-color: #88D4B4      /* アクセント（ミントグリーン） */
--accent-color-hover: #6BCB9F
--good-color: #A5D6A7        /* 良好 */
--warning-color: #FFCC80     /* 注意 */
--danger-color: #EF9A9A      /* 危険 */
--text-primary: #4A4A4A
--text-muted: #8FA39A
--shadow-sm: 0 4px 12px rgba(136, 212, 180, 0.15)
--shadow-md: 0 8px 24px rgba(136, 212, 180, 0.2)
--border-radius-card: 20px
```

**注意:** `--surface`, `--border`, `--accent` などの変数は存在しません。上記の変数名を使ってください。

---

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/api/healthApi.ts` | `toHomeSummaryFromSummary` 関数の修正 |
| `web-app/src/screens/HomeScreen.tsx` | 全面書き換え |
| `web-app/src/screens/HomeScreen.css` | 更新 |

`web-app/src/api/types.ts` は変更不要です（すでに更新済み）。

---

## Step 1: types.ts の修正

上記「背景」セクションに記載した型修正を行ってください。

## Step 2: healthApi.ts の修正

`toHomeSummaryFromSummary` 関数（`/api/home-summary` が 404 の場合のフォールバック）が
旧型（`evidences`）を参照していて TypeScript エラーが出ています。
実際のレスポンス構造（`statusItems` + `attentionPoints`）に合わせて書き換えてください：

```typescript
function toHomeSummaryFromSummary(summary: SummaryResponse, date: string): HomeSummaryResponse {
  const steps = valueOnDate(summary.stepsByDate, date)?.steps ?? null
  const sleepHours = valueOnDate(summary.sleepHoursByDate, date)?.hours ?? null
  const intakeKcal = valueOnDate(summary.intakeCaloriesByDate, date)?.kcal ?? null
  const weight = latestOnOrBeforeDate(summary.weightByDate, date)?.kg ?? null

  const sleepTotalMin = sleepHours != null ? Math.round(sleepHours * 60) : null
  const sleepH = sleepTotalMin != null ? Math.floor(sleepTotalMin / 60) : null
  const sleepM = sleepTotalMin != null ? sleepTotalMin % 60 : null
  const sleepOk = sleepHours != null && sleepHours > 0

  const stepsOk = steps != null && steps >= 1000
  const weightOk = weight != null && Number.isFinite(weight)
  const mealOk = intakeKcal != null && intakeKcal > 0

  const statusItems: HomeStatusItem[] = [
    { key: 'sleep',  label: '睡眠', value: sleepH != null ? `${sleepH}h${sleepM}m` : null, ok: sleepOk,  tab: 'health',   innerTab: 'sleep',       tone: 'normal' },
    { key: 'steps',  label: '歩数', value: steps != null ? Math.round(steps).toLocaleString('ja-JP') : null, ok: stepsOk, tab: 'exercise', tone: 'normal' },
    { key: 'meal',   label: '食事', value: intakeKcal != null ? `${Math.round(intakeKcal).toLocaleString('ja-JP')}kcal` : null, ok: mealOk, tab: 'meal', tone: 'normal' },
    { key: 'weight', label: '体重', value: weight != null ? `${weight.toFixed(1)}kg` : null, ok: weightOk, tab: 'health', innerTab: 'composition', tone: 'normal' },
  ]

  return {
    date,
    report: null,
    sufficiency: { sleep: sleepOk, steps: stepsOk, weight: weightOk, meal: mealOk },
    statusItems,
    attentionPoints: [],
  }
}
```

---

## Step 3: HomeScreen.tsx 全面書き換え

### 画面構成

```
← 2月25日（火）→

[睡眠 6h32m ✓] [歩数 3,200 ✓] [食事 ✗] [体重 72.3kg ✓] [BP 120/78 ✓]
 ↑ 横スクロール可。各項目タップで該当タブへ遷移

━━ 注目ポイント ━━
 ⚠️ 睡眠不足が3日連続          → からだ＞睡眠
 📉 体重が先週比 -0.5kg 維持中  → からだ＞体組成
 ※何もなければ「✅ 特に注目点なし。順調です」

━━ 今日のまとめ ━━（AIレポートの3者調停結論）

━━ 3人の専門家から ━━
 🩺 医師       [2行 + 詳しく→]
 🏋 トレーナー  [2行 + 詳しく→]
 🥗 栄養士     [データ欠損時は非表示]

※ AIレポートなしの場合: まとめ・専門家コメントの代わりに「前回レポートリンク」
```

### コンポーネント構成

```tsx
import React, { useEffect, useState } from 'react'
import { fetchHomeSummary } from '../api/healthApi'
import type { RequestState, HomeSummaryResponse, AttentionPoint } from '../api/types'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import './HomeScreen.css'

interface HomeScreenProps {
  onNavigate?: (tab: 'home' | 'health' | 'exercise' | 'meal' | 'my') => void
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeSummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetchHomeSummary(activeDate)
      .then(res => { if (alive) setState({ status: 'success', data: res }) })
      .catch(() => {
        if (alive) setState({
          status: 'success',
          data: {
            date: activeDate,
            report: null,
            sufficiency: { sleep: false, steps: false, weight: false, meal: false, bloodPressure: false },
            attention_points: [],
          }
        })
      })
    return () => { alive = false }
  }, [activeDate])

  return (
    <div className="home-container">
      <DateNavBar />
      {state.status === 'loading' && <div className="home-loading">読み込み中...</div>}
      {state.status === 'success' && (
        <>
          <HealthStatusBar items={state.data.statusItems ?? []} onNavigate={onNavigate} />
          <AttentionPoints points={state.data.attentionPoints ?? []} onNavigate={onNavigate} />
          <AiSection report={state.data.report} previousReport={state.data.previousReport} />
        </>
      )}
    </div>
  )
}
```

### HealthStatusBar（充足度バー）

**データソース:** `state.data.statusItems`（バックエンドが `statusItems` 配列で返す）

```tsx
const ICONS: Record<string, ReactNode> = {
  sleep:  <svg ...>{/* 月アイコン */}</svg>,
  steps:  <svg ...>{/* 波線アイコン */}</svg>,
  meal:   <svg ...>{/* フォークアイコン */}</svg>,
  weight: <svg ...>{/* 体重計アイコン */}</svg>,
  bp:     <svg ...>{/* 心臓アイコン */}</svg>,
}

function HealthStatusBar({
  items,
  onNavigate,
}: {
  items: HomeStatusItem[]
  onNavigate?: (tab: HomeStatusItem['tab']) => void
}) {
  return (
    <div className="health-status-scroll">
      <div className="health-status-bar">
        {items.map(item => (
          <div
            key={item.key}
            className={`status-pill ${item.ok ? 'on' : 'off'} ${item.tone === 'warning' ? 'warn' : ''}`}
            onClick={() => onNavigate?.(item.tab)}
          >
            <div className="status-pill-icon">{ICONS[item.key] ?? null}</div>
            <div className="status-pill-label">{item.label}</div>
            <div className="status-pill-value">
              {item.value ?? (item.ok ? '✓' : '✗')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

呼び出し側:
```tsx
<HealthStatusBar
  items={state.data.statusItems ?? []}
  onNavigate={onNavigate}
/>
```

SVGアイコンは HomeScreen.tsx 内で定義（旧 SufficiencyBar のアイコンを流用してOK）。

### AttentionPoints（注目ポイント）

```tsx
function AttentionPoints({ points, onNavigate }: { points: AttentionPoint[], onNavigate?: (tab: ...) => void }) {
  const [expanded, setExpanded] = useState(false)
  const MAX_DEFAULT = 5
  const displayed = expanded ? points : points.slice(0, MAX_DEFAULT)
  const remaining = points.length - MAX_DEFAULT

  return (
    <div className="attention-section">
      <div className="attention-title">注目ポイント</div>
      {points.length === 0 ? (
        <div className="attention-empty">✅ 特に注目点なし。順調です</div>
      ) : (
        <>
          {displayed.map(point => (
            <div
              key={point.id}
              className={`attention-item severity-${point.severity}`}
              onClick={() => point.navigateTo && onNavigate?.(point.navigateTo.tab)}
            >
              <span className="attention-icon">{point.icon}</span>
              <span className="attention-message">{point.message}</span>
              {point.navigateTo && <span className="attention-arrow">›</span>}
            </div>
          ))}
          {!expanded && remaining > 0 && (
            <div className="attention-more" onClick={() => setExpanded(true)}>
              他{remaining}件を表示
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

### AiSection（AIレポートセクション）

旧の `AiAdvisorSection`・`NoReportCard` を `AiSection` としてまとめる：

```tsx
function AiSection({
  report,
  previousReport,
}: {
  report: HomeSummaryResponse['report']
  previousReport?: HomeSummaryResponse['previousReport']
}) {
  if (!report) {
    return (
      <div className="home-no-report-card">
        <div>AIレポートはまだありません</div>
        {previousReport ? (
          <div style={{ fontSize: 13, marginTop: 6, color: 'var(--accent-color)' }}>
            前回のレポート（{previousReport.date}）を見る →
          </div>
        ) : (
          <div style={{ fontSize: 13, marginTop: 6 }}>データが揃ったらレポートを生成できます</div>
        )}
      </div>
    )
  }
  const sections = extractAgentSections(report.content)
  return (
    <div className="ai-section">
      {/* 3者コメント（医師・トレーナー・栄養士） */}
      {/* 旧 AiCard / AiAdvisorSection の実装をそのまま使用 */}
    </div>
  )
}
```

`extractAgentSections`・`AiCard` の実装は既存のものをそのまま使用してください。

### 削除するコンポーネント

- `SufficiencyBar` — `HealthStatusBar` に置き換え
- `EvidenceList` — 廃止（導線は `HealthStatusBar` と `AttentionPoints` が担う）
- `EmptyState` — 廃止（`HealthStatusBar` がオフ状態で代替）

---

## Step 4: HomeScreen.css 更新

既存の `.home-sufficiency-bar`, `.sufficiency-pill`, `.evidence-*` スタイルを削除し、以下を追加：

```css
/* 横スクロールラッパー */
.health-status-scroll {
  overflow-x: auto;
  padding: 4px 16px 8px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.health-status-scroll::-webkit-scrollbar { display: none; }

.health-status-bar {
  display: flex;
  gap: 8px;
  min-width: max-content;
}

/* 各ステータスピル */
.status-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 14px 10px;
  border-radius: 16px;
  background: var(--surface-color);
  border: 1px solid rgba(136, 212, 180, 0.15);
  cursor: pointer;
  min-width: 64px;
  transition: all 0.2s ease;
}
.status-pill.on {
  background: linear-gradient(135deg, #f0fdf7 0%, #e6f9f0 100%);
  border-color: rgba(136, 212, 180, 0.4);
  box-shadow: 0 4px 12px rgba(136, 212, 180, 0.12);
}
.status-pill.off {
  background: #f8f9fc;
  border-color: #f1f3f5;
  opacity: 0.7;
}
.status-pill.warn {
  background: rgba(255, 204, 128, 0.15);
  border-color: rgba(255, 152, 0, 0.4);
}
.status-pill-icon {
  color: var(--text-muted);
  margin-bottom: 4px;
}
.status-pill.on .status-pill-icon { color: var(--accent-color); }
.status-pill.warn .status-pill-icon { color: #f57c00; }
.status-pill-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.4px;
}
.status-pill-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2px;
  white-space: nowrap;
}
.status-pill.off .status-pill-value { color: var(--text-muted); }

/* 注目ポイントセクション */
.attention-section {
  margin: 0 16px 8px;
  background: var(--surface-color);
  border-radius: var(--border-radius-card);
  border: 1px solid rgba(136, 212, 180, 0.2);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.attention-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid rgba(136, 212, 180, 0.15);
}
.attention-empty {
  padding: 12px 16px;
  font-size: 13px;
  color: #2f7f64;
  font-weight: 600;
}
.attention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(136, 212, 180, 0.1);
  transition: background 0.15s;
}
.attention-item:last-child { border-bottom: none; }
.attention-item:active { background: rgba(136, 212, 180, 0.08); }
.attention-item.severity-critical { background: rgba(239, 154, 154, 0.1); }
.attention-item.severity-critical .attention-message { font-weight: 700; }
.attention-item.severity-warning .attention-icon { color: #f57c00; }
.attention-item.severity-positive .attention-icon { color: #388e3c; }
.attention-icon { font-size: 16px; flex-shrink: 0; }
.attention-message { flex: 1; font-size: 13px; color: var(--text-primary); }
.attention-arrow { color: var(--text-muted); font-size: 18px; }
.attention-more {
  padding: 10px 16px;
  font-size: 12px;
  color: var(--accent-color);
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

/* AIセクション */
.ai-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
}
```

残りのスタイル（`.ai-advisor-card`, `.ai-card-*`, `.home-no-report-card` 等）は既存のものをそのまま残してください。

---

## Graceful Degradation

| 状態 | 条件 | 表示 |
|---|---|---|
| A: 通常 | AIレポートあり | HealthStatusBar + AttentionPoints + AiSection |
| B: 部分 | AIレポートなし + データあり | HealthStatusBar + AttentionPoints + NoReportCard |
| C: 最小 | データなし | HealthStatusBar（全✗）+ AttentionPoints（0件→「特になし」）+ NoReportCard |

---

## 注意事項

- `import React from 'react'` を先頭に記述
- `EvidenceList` コンポーネントは削除してください（`HomeScreen.css` の `.evidence-*` スタイルも削除）
- `SufficiencyBar` コンポーネントは削除してください
- タブ遷移は `onNavigate` prop 経由（既存のまま）
- `types.ts` は変更不要（既に更新済み）
