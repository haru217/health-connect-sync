# Haru Briefing Generation UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HomeScreenのハルブリーフィングをオンデマンド生成方式に変更し、未生成/生成中/表示済み/失敗の4状態UIを実装する

**Architecture:** バックエンドのhome-summaryクエリを完全一致に変更してフォールバックを廃止し、フロントのHaruBriefingコンポーネントを独立ファイルに抽出して生成ボタン+タイピングアニメーション+トースト通知を追加する

**Tech Stack:** React 19 + TypeScript + Vite (frontend), Cloudflare Workers + D1 (backend)

**Spec:** `docs/superpowers/specs/2026-03-17-haru-briefing-generation-ui-design.md`

---

## Chunk 1: バックエンド変更 + API関数追加

### Task 1: home-summaryクエリ変更（フォールバック廃止）

**Files:**
- Modify: `cloudflare-api/src/handlers/home-summary.ts:112-141` (reportRowクエリ変更)
- Modify: `cloudflare-api/src/handlers/home-summary.ts:235-258` (レスポンスからpreviousReport削除)

- [ ] **Step 1: reportRowクエリを完全一致に変更**

`cloudflare-api/src/handlers/home-summary.ts` L112-130のreportRowクエリを変更する。

変更前:
```typescript
    queryFirst<{
      date: string
      headline: string | null
      briefing: string | null
      yu_comment: string | null
      saki_comment: string | null
      mai_comment: string | null
      generated_at: string
    }>(
      db,
      `
      SELECT date, headline, briefing, yu_comment, saki_comment, mai_comment, generated_at
      FROM daily_reports
      WHERE date <= ?
      ORDER BY date DESC
      LIMIT 1
      `,
      [date],
    ),
```

変更後:
```typescript
    queryFirst<{
      date: string
      headline: string | null
      briefing: string | null
      yu_comment: string | null
      saki_comment: string | null
      mai_comment: string | null
      generated_at: string
    }>(
      db,
      `
      SELECT date, headline, briefing, yu_comment, saki_comment, mai_comment, generated_at
      FROM daily_reports
      WHERE date = ?
      LIMIT 1
      `,
      [date],
    ),
```

- [ ] **Step 2: previousReportRowクエリを削除**

L131-142の`previousReportRow`クエリを`Promise.all`から削除する。L58の分割代入から`previousReportRow`を削除する。

変更前（Promise.all内、最後の要素）:
```typescript
    queryFirst<{ date: string; generated_at: string }>(
      db,
      `
      SELECT date, generated_at
      FROM daily_reports
      WHERE date < ?
      ORDER BY date DESC
      LIMIT 1
      `,
      [date],
    ),
```

この要素を丸ごと削除する。

- [ ] **Step 3: レスポンスからpreviousReportフィールドを削除**

L253-258を削除する。

変更前:
```typescript
    previousReport: previousReportRow
      ? {
          date: previousReportRow.date,
          generated_at: previousReportRow.generated_at,
        }
      : null,
```

この部分を丸ごと削除する。

- [ ] **Step 4: 動作確認**

Run: `cd cloudflare-api && npx wrangler dev --local`

`curl "http://localhost:8787/api/home-summary?date=2026-03-17"` でレスポンスに`previousReport`が含まれないことを確認。レポートがない日付を指定して`report: null`が返ることを確認。

- [ ] **Step 5: Commit**

```bash
git add cloudflare-api/src/handlers/home-summary.ts
git commit -m "fix: home-summaryのレポートクエリを完全一致に変更しフォールバック廃止"
```

---

### Task 2: フロントエンドの型定義更新

**Files:**
- Modify: `web-app/src/api/types.ts:272-275` (PreviousReportLink削除)
- Modify: `web-app/src/api/types.ts:303` (previousReportフィールド削除)

- [ ] **Step 1: PreviousReportLink型を削除**

`web-app/src/api/types.ts` L272-275を削除する。

```typescript
// 削除する部分:
export interface PreviousReportLink {
  date: string
  generated_at: string
}
```

- [ ] **Step 2: HomeSummaryResponseからpreviousReportフィールドを削除**

L303を削除する。

```typescript
// 削除する行:
  previousReport?: PreviousReportLink | null
```

- [ ] **Step 3: Commit**

```bash
git add web-app/src/api/types.ts
git commit -m "refactor: HomeSummaryResponseからpreviousReport型を削除"
```

---

### Task 3: generateDailyReport API関数の追加

**Files:**
- Modify: `web-app/src/api/healthApi.ts` (新規関数追加)

- [ ] **Step 1: generateDailyReport関数を追加**

`web-app/src/api/healthApi.ts` の末尾に追加する。

```typescript
export interface GenerateDailyReportResponse {
  date: string
  generated: boolean
  cached: boolean
  generated_at?: string
}

export async function generateDailyReport(date: string): Promise<GenerateDailyReportResponse> {
  return apiFetch<GenerateDailyReportResponse>('/api/report/generate', {
    method: 'POST',
    body: JSON.stringify({ date }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/api/healthApi.ts
git commit -m "feat: generateDailyReport API関数を追加"
```

---

## Chunk 2: Toastコンポーネント

### Task 4: 汎用Toastコンポーネントの作成

**Files:**
- Create: `web-app/src/components/Toast.tsx`

- [ ] **Step 1: Toastコンポーネントを作成**

```typescript
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  duration?: number
  onDismiss: () => void
}

export default function Toast({ message, duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), duration - 300)
    const dismissTimer = setTimeout(onDismiss, duration)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(dismissTimer)
    }
  }, [duration, onDismiss])

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '16px',
        right: '16px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'var(--danger-bg, #fef2f2)',
        color: 'var(--danger-color, #dc2626)',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      }}
    >
      {message}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/Toast.tsx
git commit -m "feat: 汎用Toastコンポーネントを追加"
```

---

## Chunk 3: HaruBriefingコンポーネント抽出 + 新機能

### Task 5: HaruBriefingコンポーネントの抽出と改修

**Files:**
- Create: `web-app/src/components/HaruBriefing.tsx`
- Create: `web-app/src/components/HaruBriefing.css`
- Modify: `web-app/src/screens/HomeScreen.tsx` (既存HaruBriefing削除、import差し替え)

- [ ] **Step 1: HaruBriefing.cssを作成（タイピングアニメーション）**

```css
.typing-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}

.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing-blink 1.4s infinite both;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
```

- [ ] **Step 2: HaruBriefing.tsxを作成**

`web-app/src/components/HaruBriefing.tsx` を新規作成する。

以下の要件を満たすこと:

**Props:**
```typescript
interface HaruBriefingProps {
  briefing?: string | null
  activeDate: string
  onGenerate: () => void
  generating: boolean
}
```

**状態分岐ロジック:**
- `generating === true` → タイピングアニメーション表示
- `briefing` が存在 → 現状通りの本文表示（段落フェードイン、セクション見出しカラー表示）
- `briefing` がnull/undefined → 未生成UI（語りかけテキスト+ボタン）

**未生成UIの吹き出しテキスト:**
- 当日（`activeDate === toIsoDate(new Date())`）: 「データを同期したら、ブリーフィングを作れるよ」
- 過去日: 「{M月d日}のブリーフィングを作れるよ」

**生成ボタン:**
- テキスト: 「ブリーフィングを作る」
- 吹き出し内に配置
- `onGenerate` を呼び出す

**移植する機能（HomeScreen.tsxから）:**
- `renderMarkdownText` 関数（`**太字**`のパース）
- `sectionConfig` + 部分一致マッチングに修正
- 段落フェードインアニメーション
- 吹き出しのCSS（三角ポインターの`drop-shadow`を削除）

**バグ修正 — セクション見出しアイコンのマッチング:**

変更前:
```typescript
const config = sectionConfig[sectionTitle as keyof typeof sectionConfig] || sectionConfig['その他'];
```

変更後:
```typescript
const configEntry = Object.entries(sectionConfig).find(
  ([key]) => key !== 'その他' && sectionTitle.startsWith(key)
)
const config = configEntry ? configEntry[1] : sectionConfig['その他']
```

**バグ修正 — 吹き出しポインターのdrop-shadow削除:**

外側の三角divから `filter: 'drop-shadow(-1px 0px 1px rgba(0,0,0,0.05))'` を削除する。

- [ ] **Step 3: HomeScreen.tsxから旧コードを削除し、新コンポーネントをimport**

削除するもの:
- `HaruBriefing` 関数コンポーネント全体（L169-334）
- `ExpertSection` 関数コンポーネント全体（L88-117）
- `HomeReport` interface（L82-86）
- `renderMarkdownText` 関数（L349-364）
- `sectionConfig` の定義部分は `HaruBriefing.tsx` に移動済みなので削除

追加するもの:
- `import HaruBriefing from '../components/HaruBriefing'`
- `import Toast from '../components/Toast'`
- `import { generateDailyReport } from '../api/healthApi'` （既存importに追加）
- 生成状態管理: `const [generating, setGenerating] = useState(false)`
- トースト状態管理: `const [toastMessage, setToastMessage] = useState<string | null>(null)`

**handleGenerateブリーフィング関数を追加:**
```typescript
const handleGenerateBriefing = useCallback(async () => {
  setGenerating(true)
  try {
    await generateDailyReport(activeDate)
    const summaryRes = await fetchHomeSummary(activeDate)
    setState(prev => {
      if (prev.status !== 'success') return prev
      return { ...prev, data: { ...prev.data, summary: summaryRes } }
    })
  } catch {
    setToastMessage('ブリーフィングの生成に失敗しました')
  } finally {
    setGenerating(false)
  }
}, [activeDate])
```

**JSXの差し替え（L704-709付近）:**

変更前:
```tsx
<HaruBriefing
  briefing={content.summary.report?.briefing}
  fallbackReport={content.summary.report?.home ?? undefined}
  reportDate={content.summary.report?.reportDate}
  activeDate={activeDate}
/>
```

変更後:
```tsx
<HaruBriefing
  briefing={content.summary.report?.briefing}
  activeDate={activeDate}
  onGenerate={handleGenerateBriefing}
  generating={generating}
/>
```

**トースト表示をJSXの末尾に追加:**
```tsx
{toastMessage ? (
  <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
) : null}
```

- [ ] **Step 4: ビルド確認**

Run: `cd web-app && npx vite build`

TypeScriptエラーがないことを確認する。

- [ ] **Step 5: Commit**

```bash
git add web-app/src/components/HaruBriefing.tsx web-app/src/components/HaruBriefing.css web-app/src/screens/HomeScreen.tsx
git commit -m "feat: HaruBriefingをオンデマンド生成方式に変更しバグ修正"
```

---

## Chunk 4: クリーンアップ

### Task 6: 不要コードの削除

**Files:**
- Modify: `web-app/src/screens/HomeScreen.css` (expert-section関連CSSの削除候補確認)

- [ ] **Step 1: ExpertCardの使用箇所を確認**

`ExpertCard`がHomeScreen以外で使われていないか確認する。

Run: `cd web-app && grep -r "ExpertCard\|ExpertSection\|expert-section" src/ --include="*.tsx" --include="*.ts"`

HomeScreenからのimportが削除済みで他に使用箇所がなければ、HomeScreen.cssの`.expert-section`〜`.expert-expand-btn`のCSSブロック（L207-357）は削除候補。ただし`ExpertCard.tsx`自体は他画面で再利用される可能性があるため、コンポーネントファイルは残す。

- [ ] **Step 2: HomeScreen.cssからexpert-section CSSを削除**

ExpertCardが他で使用されていない場合、L207-357の`.expert-section`から`.expert-expand-btn:hover`までを削除する。

- [ ] **Step 3: ビルド+目視確認**

Run: `cd web-app && npx vite build && npx vite preview`

- HomeScreenを開いてブリーフィング未生成状態のUIを確認
- ボタンを押して生成中のタイピングアニメーションを確認
- 生成完了後にブリーフィングが表示されることを確認
- セクション見出しにアイコンが正しく出ることを確認
- 吹き出しポインターに黒い影がないことを確認
- DateNavBarで過去日に移動して未生成UIが出ることを確認

- [ ] **Step 4: Commit**

```bash
git add web-app/src/screens/HomeScreen.css
git commit -m "refactor: ExpertSection関連の未使用CSSを削除"
```
