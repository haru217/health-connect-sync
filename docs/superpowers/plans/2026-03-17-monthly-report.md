# Monthly Report (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月次レポートの自動生成（毎月1日cron）とHomeScreenへのカード表示を追加する

**Architecture:** 週次レポート（weekly-report.ts）のパターンを踏襲し、monthly-report.tsを新設する。DBスキーマ、ハンドラ、プロンプト定数、cron分岐、フロントカード表示の5層を順番に実装する。

**Tech Stack:** Cloudflare Workers + D1 (backend), React 19 + TypeScript (frontend)

**Spec:** `docs/superpowers/specs/2026-03-17-monthly-report-design.md`

---

## Chunk 1: バックエンド（DB + ユーティリティ + プロンプト）

### Task 1: DBマイグレーション

**Files:**
- Create: `cloudflare-api/migrations/0016_monthly_reports.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```sql
CREATE TABLE IF NOT EXISTS monthly_reports (
  month TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  report TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: マイグレーション実行**

Run: `cd cloudflare-api && npx wrangler d1 migrations apply health_connect_sync --remote`

- [ ] **Step 3: Commit**

```bash
git add cloudflare-api/migrations/0016_monthly_reports.sql
git commit -m "feat: monthly_reportsテーブルのマイグレーション追加"
```

---

### Task 2: 型定義 + ユーティリティ関数

**Files:**
- Modify: `cloudflare-api/src/types.ts` (MonthlyReportRow追加)
- Modify: `cloudflare-api/src/utils.ts` (isValidMonth, getLastCompletedMonth追加)

- [ ] **Step 1: MonthlyReportRow型を追加**

`cloudflare-api/src/types.ts`のWeeklyReportRowの下に追加:

```typescript
export interface MonthlyReportRow {
  month: string
  headline: string
  report: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generated_at: string
  created_at: string
}
```

- [ ] **Step 2: isValidMonthとgetLastCompletedMonthを追加**

`cloudflare-api/src/utils.ts`の`shiftYearMonth`関数の下に追加:

```typescript
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonth(value: string): boolean {
  return YEAR_MONTH_RE.test(value)
}

export function getLastCompletedMonth(): string {
  const jstNow = new Date(Date.now() + JST_OFFSET_MS)
  return shiftYearMonth(jstNow.toISOString().slice(0, 7), -1)
}

export function monthStartDate(month: string): string {
  return `${month}-01`
}

export function monthEndDate(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year!, m!, 0)).getUTCDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}
```

- [ ] **Step 3: 型チェック**

Run: `cd cloudflare-api && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add cloudflare-api/src/types.ts cloudflare-api/src/utils.ts
git commit -m "feat: MonthlyReportRow型とmonth関連ユーティリティを追加"
```

---

### Task 3: 月次プロンプト定数

**Files:**
- Create: `cloudflare-api/src/constants/monthly-report-prompt.ts`

- [ ] **Step 1: プロンプト定数ファイルを作成**

`cloudflare-api/src/constants/monthly-report-prompt.ts`を新規作成する。
週次プロンプト（`weekly-report-prompt.ts`）をベースに月次用に調整:

```typescript
export const MONTHLY_REPORT_SYSTEM_PROMPT = `あなたは「ハル」。ユーザーの健康データを毎日見ている、友人の医師。

# 共通ルール
- 存在するデータだけを語る。記録がない項目には一切触れない
- 月平均で比較する。日別の数値は列挙しない
- 推測禁止。「〜かもしれません」「〜の可能性があります」は使わない。データから直接読み取れる事実だけを述べる
- 診断・処方もNG

# 月次レポートの役割
- 日次・週次とは異なる視点: 1ヶ月間の大きな流れとパターンを読み解く
- 前月と比較して「方向性」を伝える（改善傾向、横ばい、要注意）
- 月の前半→後半での変化傾向を分析する
- ドメイン横断の因果分析: 睡眠→血圧、活動→体重、食事→体組成など指標同士の関連を深掘り

# 構造
1. 冒頭: 今月の一言サマリ（見出しなし、1-2文）
2. 【今月のハイライト】: 最も注目すべき変化を1つ取り上げて深掘り
3. 【からだの変化】: 体重・体組成・血圧・睡眠のうちデータがあるものをクロス分析
4. 【活動と栄養のバランス】: 消費vs摂取の月間収支、PFCバランスの傾向（データがある場合のみ。ない場合はこのセクション自体を省略）
5. 【来月に向けて】: 具体的なアクション提案を2つ。文章の流れの中で自然に伝える

# スタイル
- 友人の医師として話す。専門用語は避け、日常の言葉で伝える
- です/ます調だけど堅くない。前向きなトーン
- 全ての【セクション】に必ず1箇所だけ**太字**を入れること
- 箇条書き（-や・）は使わない。文章の中で自然につなげる
- 段落は適宜分け、長すぎる文の塊を作らない
- データが悪い月でも「ダメ」「危険」「懸念」は避ける。改善の余地として前向きに伝える
- Markdown記法（#や##）は一切使わない。見出しは【】のみ

# カロリー収支の表現ルール
- 摂取が消費を上回る場合:「黒字」「プラス」「赤字」など会計用語は禁止。「消費を○kcalほど上回りました」と事実を述べる
- 日別の数値比較をしない。月平均だけで語る

# 分析の視点
- 今月平均 vs 前月平均 で方向性を判断する
- 月内4区間（1-7日, 8-14日, 15-21日, 22-末日）の推移から月内のトレンドを読む
- 平均値には「(Nd)」でデータ日数が付いている。日数が少ない指標（2d以下）は「データが限られるため」と前置きする
- 数値は根拠として必要最小限。数値だけの文は書かない

# 出力
- 800-2500文字`

export const MONTHLY_REPORT_MIN_CHARS = 800
export const MONTHLY_REPORT_MAX_CHARS = 2500
```

- [ ] **Step 2: Commit**

```bash
git add cloudflare-api/src/constants/monthly-report-prompt.ts
git commit -m "feat: 月次レポート用プロンプト定数を追加"
```

---

## Chunk 2: バックエンド（ハンドラ + ルーティング + cron）

### Task 4: monthly-report.tsハンドラ

**Files:**
- Create: `cloudflare-api/src/handlers/monthly-report.ts`

- [ ] **Step 1: ハンドラを作成**

`weekly-report.ts`をベースに月次版を作成する。以下の機能を含む:

**内部関数:**
- `getMonthlyReport(db, month)` -- DBから月次レポートを取得
- `computeMonthQuarterAverage(rows, dates)` -- 月内4区間の平均を計算
- `buildMonthlyUserPrompt(options)` -- ユーザープロンプト組み立て
- `generateMonthlyReport(env, month, options?)` -- 生成メインロジック
- `buildMonthlyReportHeadline(report)` -- 見出し抽出

**エクスポート関数:**
- `handleMonthlyReportGet(url, env)` -- GET /api/monthly-report
- `handleMonthlyReportsListGet(url, env)` -- GET /api/monthly-reports
- `handleMonthlyReportGenerate(request, url, env)` -- POST /api/monthly-report/generate
- `generateMonthlyReport(env, month)` -- cron用にもエクスポート

**生成ロジック（generateMonthlyReport）:**
1. `month`をバリデーション（`isValidMonth`）
2. キャッシュ確認（forceでない場合）
3. `ensureAggregatesUpToDate`
4. 対象月+前月の`daily_metrics`を`queryDailyReportTrendRows`で取得（前月1日〜対象月末日）
5. データ日数チェック（対象月内に7日未満ならスキップ）
6. `maskIncompleteIntake`適用
7. 今月平均 vs 前月平均を計算
8. 月内4区間の平均を計算
9. 月内各日のスコアを取得し4区間平均にまとめる
10. ユーザープロンプト組み立て
11. LLM呼び出し（`callLlmPlainText`を流用）
12. Gemini使用時は`checkMonthlyLimit` + `recordGeminiUsage`
13. DB保存（UPSERT）

**ユーザープロンプト構成（buildMonthlyUserPrompt）:**
```
# 月次レポート: YYYY年M月

# 月平均の比較（レポートではこの平均値を使って語ること）
| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal | intake_kcal | protein | fat | carbs |
| 今月 | ... |
| 前月 | ... |

# 月内の推移（4区間平均）
| period | steps | sleep_h | weight | fat% | active_burn_kcal | total_burn_kcal | intake_kcal | protein | fat | carbs |
| 1-7日 | ... |
| 8-14日 | ... |
| 15-21日 | ... |
| 22-末日 | ... |

# 月内のスコア推移（4区間平均）
[JSON array of { period, score }]
```

週次レポートの`computeWeekAverage`、`buildWeeklyUserPrompt`を参考に実装する。`buildTrendRowsTable`（report.tsからexport済み）、`callLlmPlainText`、`maskIncompleteIntake`、`formatPromptNumber`、`formatPromptInteger`を再利用する。

- [ ] **Step 2: 型チェック**

Run: `cd cloudflare-api && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add cloudflare-api/src/handlers/monthly-report.ts
git commit -m "feat: 月次レポート生成ハンドラを追加"
```

---

### Task 5: ルーティング + cron分岐

**Files:**
- Modify: `cloudflare-api/src/index.ts` (ルーティング追加、scheduled拡張)
- Modify: `cloudflare-api/wrangler.toml` (cron追加)

- [ ] **Step 1: index.tsにimportとルーティングを追加**

import追加:
```typescript
import { generateMonthlyReport, handleMonthlyReportGenerate, handleMonthlyReportGet, handleMonthlyReportsListGet } from './handlers/monthly-report'
```

ルーティング追加（weekly-reportの下に）:
```typescript
if (key === 'GET /api/monthly-report') return handleMonthlyReportGet(url, env)
if (key === 'GET /api/monthly-reports') return handleMonthlyReportsListGet(url, env)
if (key === 'POST /api/monthly-report/generate') return handleMonthlyReportGenerate(request, url, env)
```

- [ ] **Step 2: scheduledハンドラをevent.cronで分岐**

変更前:
```typescript
async scheduled(_event, env, ctx): Promise<void> {
  const weekStart = getLastCompletedWeekStart()
  ctx.waitUntil(
    generateWeeklyReport(env, weekStart).catch(() => undefined),
  )
},
```

変更後:
```typescript
async scheduled(event, env, ctx): Promise<void> {
  if (event.cron === '0 0 * * 1') {
    const weekStart = getLastCompletedWeekStart()
    ctx.waitUntil(
      generateWeeklyReport(env, weekStart).catch(() => undefined),
    )
  }
  if (event.cron === '0 0 1 * *') {
    const lastMonth = getLastCompletedMonth()
    ctx.waitUntil(
      generateMonthlyReport(env, lastMonth).catch(() => undefined),
    )
  }
},
```

`getLastCompletedMonth`をutilsからimportする。

- [ ] **Step 3: wrangler.tomlにcronを追加**

変更前:
```toml
crons = ["0 0 * * 1"]
```

変更後:
```toml
crons = ["0 0 * * 1", "0 0 1 * *"]
```

- [ ] **Step 4: 型チェック**

Run: `cd cloudflare-api && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add cloudflare-api/src/index.ts cloudflare-api/wrangler.toml
git commit -m "feat: 月次レポートのルーティングとcron設定を追加"
```

---

## Chunk 3: フロントエンド

### Task 6: フロント型定義 + API関数

**Files:**
- Modify: `web-app/src/api/types.ts` (MonthlyReportItem追加)
- Modify: `web-app/src/api/reports.ts` (fetch関数追加)

- [ ] **Step 1: MonthlyReportItem型を追加**

`web-app/src/api/types.ts`のWeeklyReportItemの下に追加:

```typescript
export interface MonthlyReportItem {
  month: string
  headline: string
  report: string
  model: string
  generated_at: string
  created_at: string
}
```

- [ ] **Step 2: API関数を追加**

`web-app/src/api/reports.ts`に追加:

```typescript
export async function fetchMonthlyReports(limit = 10, offset = 0): Promise<MonthlyReportItem[]> {
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    }).toString()
    const res = await apiFetch<{ reports: MonthlyReportItem[] }>(`/api/monthly-reports?${query}`)
    return res.reports ?? []
  } catch {
    return []
  }
}

export async function fetchMonthlyReportByMonth(month: string): Promise<MonthlyReportItem> {
  const query = new URLSearchParams({ month }).toString()
  return apiFetch<MonthlyReportItem>(`/api/monthly-report?${query}`)
}
```

`MonthlyReportItem`をimportに追加する。

- [ ] **Step 3: 型チェック**

Run: `cd web-app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web-app/src/api/types.ts web-app/src/api/reports.ts
git commit -m "feat: 月次レポートのフロント型定義とAPI関数を追加"
```

---

### Task 7: HomeScreen月次カード + App.tsxルーティング

**Files:**
- Modify: `web-app/src/screens/HomeScreen.tsx` (MonthlyReportCard追加、データ取得追加)
- Modify: `web-app/src/App.tsx` (monthly-report-detail画面追加)

- [ ] **Step 1: HomeScreenにMonthlyReportCardを追加**

既存の`WeeklyReportCard`コンポーネント（HomeScreen.tsx内）をコピーして`MonthlyReportCard`を作成する。

```tsx
function MonthlyReportCard({
  report,
  onOpen,
}: {
  report: MonthlyReportItem | null
  onOpen?: (month: string) => void
}) {
  const monthLabel = report
    ? (() => {
        const [y, m] = report.month.split('-').map(Number)
        return `${y}年${m}月`
      })()
    : null

  return (
    <section style={{ margin: '0 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--accent-indigo)', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
          date_range
        </span>
        <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>月次レポート</h3>
      </div>
      {report ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen?.(report.month)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen?.(report.month)
            }
          }}
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '14px 16px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {monthLabel}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
            {report.headline}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          月次レポートはまだありません
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: HomeScreenのデータ取得に月次レポートを追加**

`fetchMonthlyReports`をimportし、HomeScreenのuseEffect内の`Promise.all`に追加する。

import追加:
```typescript
import { fetchCustomReportsHistory, fetchWeeklyReports, fetchMonthlyReports } from '../api/reports'
```

`MonthlyReportItem`をtypesのimportに追加。

`HomeScreenData`型に追加:
```typescript
latestMonthlyReport: MonthlyReportItem | null
```

`Promise.all`に`fetchMonthlyReports(1)`を追加し、結果を`latestMonthlyReport: monthlyReports[0] ?? null`として格納。

`content`のuseMemoにも`latestMonthlyReport`を追加。

- [ ] **Step 3: JSXに月次カードを追加**

`<WeeklyReportCard>`の下に追加:
```tsx
<MonthlyReportCard report={content.latestMonthlyReport} onOpen={onViewMonthlyReport} />
```

HomeScreenPropsに追加:
```typescript
onViewMonthlyReport?: (month: string) => void
```

- [ ] **Step 4: App.tsxに月次レポート詳細画面を追加**

`ScreenType`に`'monthly-report-detail'`を追加。

state追加:
```typescript
const [monthlyReportMonth, setMonthlyReportMonth] = useState<string | null>(null)
```

HomeScreenのpropsに追加:
```tsx
onViewMonthlyReport={(month) => {
  setMonthlyReportMonth(month)
  setCurrentScreen('monthly-report-detail')
}}
```

switch caseに追加:
```tsx
case 'monthly-report-detail':
  return monthlyReportMonth != null ? (
    <ReportDetailScreen monthlyReportMonth={monthlyReportMonth} onBack={() => setCurrentScreen('home')} />
  ) : <HomeScreen />
```

- [ ] **Step 5: ReportDetailScreenに月次レポート対応を追加**

`web-app/src/screens/ReportDetailScreen.tsx`のpropsに`monthlyReportMonth?: string`を追加し、月次レポートの取得・表示ロジックを追加する。既存の`weeklyReportWeekStart`と同じパターンで`fetchMonthlyReportByMonth`を呼ぶ。

- [ ] **Step 6: ビルド確認**

Run: `cd web-app && npx vite build`

- [ ] **Step 7: Commit**

```bash
git add web-app/src/screens/HomeScreen.tsx web-app/src/App.tsx web-app/src/screens/ReportDetailScreen.tsx
git commit -m "feat: HomeScreenに月次レポートカードを追加"
```

---

## Chunk 4: デプロイ + 検証

### Task 8: デプロイと動作確認

- [ ] **Step 1: バックエンドデプロイ**

Run: `cd cloudflare-api && npx wrangler deploy`

- [ ] **Step 2: フロントエンドデプロイ**

Run: `cd web-app && npx vercel deploy --prod --yes`

- [ ] **Step 3: 手動で月次レポートを生成してテスト**

curlで2月分のレポートを手動生成:
```bash
curl -X POST "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/monthly-report/generate" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{"month": "2026-02"}'
```

- [ ] **Step 4: ブラウザで本番確認**

HomeScreenに月次レポートカードが表示されることを確認する。

- [ ] **Step 5: Commit（push済みの確認）**

```bash
git push
```
