# Request: HomeScreen UX改善 3件（U1）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（UX改善）
- Depends on: なし
- Priority: 高

## 概要

HomeScreen.tsx を中心に3つのUX改善を一括で実装する。

## Issue 1: 過去レポートの展開/折りたたみ

### 問題
`reports.ts:22` でexcerptを200文字に切り詰めており、フル表示機能がない。

### 修正内容

1. `web-app/src/api/reports.ts` に `fetchCustomReportById(id)` 関数を追加:
```typescript
export async function fetchCustomReportById(id: number): Promise<string> {
    const res = await apiFetch<{ report: string }>(`/api/custom-report/${id}`)
    return res.report
}
```

2. `web-app/src/screens/HomeScreen.tsx` の `CustomReportSection` を修正:
   - `expandedId` stateを追加
   - `fullTexts` stateを追加（`Record<number, string>`）
   - カードクリックで展開/折りたたみ（初回クリック時に `fetchCustomReportById` でフルテキスト取得）
   - 展開時はフルテキスト表示、折りたたみ時はexcerpt表示
   - ExpertCardの「続きを読む」パターン踏襲
   - 表示上限を3件→5件に変更（`history.slice(0, 3)` → `history.slice(0, 5)`）

## Issue 2: AIコメントのレポート日付ラベル

### 問題
`home-summary.ts:125` の `WHERE date <= ?` が直近レポートを返すため、3/3〜3/5で同一コメントが表示される。フロントがどの日のレポートかを表示しない。

### 修正内容

`HaruBriefing` コンポーネントに `reportDate` と `activeDate` props を追加:
- レポート日付(`reportDate`)と表示日付(`activeDate`)が異なる場合、「○月○日のレポート」ラベルを表示
- APIレスポンスの `report.reportDate` を使用（すでに `HomeSummaryResponse` に含まれている）

呼び出し元の修正:
```tsx
<HaruBriefing
  briefing={content.summary.report?.briefing}
  fallbackReport={content.summary.report?.home ?? undefined}
  reportDate={content.summary.report?.reportDate}
  activeDate={activeDate}
/>
```

## Issue 4: テンプレートボタンのUI改善

### 修正内容

TEMPLATES定数を構造変更:
```typescript
const TEMPLATES = [
  { id: 'weight', emoji: '🏋️', label: '体重の変化', desc: '体重推移を分析' },
  { id: 'sleep', emoji: '😴', label: '睡眠の質', desc: 'パターンを分析' },
  { id: 'blood_pressure', emoji: '💓', label: '血圧の傾向', desc: '傾向を分析' },
  { id: 'activity', emoji: '🏃', label: '運動量', desc: '活動量を分析' },
  { id: 'nutrition', emoji: '🍽️', label: '食事バランス', desc: '栄養を分析' },
  { id: 'general', emoji: '📊', label: '全体の健康', desc: '総合分析' },
] as const
```

flex-wrapピルを2カラムgridカードに変更:
```
┌──────────────┐┌──────────────┐
│ 🏋️ 体重の変化 ││ 😴 睡眠の質   │
│ 体重推移を分析 ││ パターンを分析 │
└──────────────┘└──────────────┘
```

レンダリング変更:
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
  {TEMPLATES.map(t => (
    <button key={t.id} disabled={loadingId === t.id} onClick={() => handleClick(t.id)}
      style={{
        padding: '14px 12px', borderRadius: '12px',
        background: 'var(--surface)', border: '1px solid var(--border-color)',
        textAlign: 'left', cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        opacity: loadingId === t.id ? 0.7 : 1,
      }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.emoji}</div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
        {loadingId === t.id ? '生成中...' : t.label}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.desc}</div>
    </button>
  ))}
</div>
```

## 変更ファイル

- `web-app/src/api/reports.ts` — `fetchCustomReportById()` 追加
- `web-app/src/screens/HomeScreen.tsx` — 3件のIssueを全て反映

## 検証

```bash
cd web-app && npx tsc --noEmit
```
