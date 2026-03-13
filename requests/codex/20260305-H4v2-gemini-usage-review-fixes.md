# Request: Gemini使用量管理レビュー修正（H4v2）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `open`
- Phase: H（ハルUX v2）
- Depends on: H4
- Priority: 高

## 概要

H4（Gemini月額上限制御）のコードレビューで検出された4件を修正する。

## 修正内容

### CRITICAL-1: report.ts の APIキーをURLからヘッダーに移行

**ファイル**: `cloudflare-api/src/handlers/report.ts`
**場所**: `callGeminiDailyReport()` 内（L561付近）

food.ts は H3v2 で修正済みだが、report.ts は未修正。

修正:
```typescript
// 変更前
const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`
const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  // ...
})

// 変更後
const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  // ...
})
```

### WARNING-1: トークン単価を公式価格に更新

**ファイル**: `cloudflare-api/src/constants.ts`
**場所**: L79-80

Gemini 2.5 Flash 公式価格（1 USD = 150 JPY）に合わせて更新。現在の値は約33%安く、実費が上限前に1000円を超過するリスクがある。

修正:
```typescript
// 変更前
export const GEMINI_COST_PER_PROMPT_TOKEN_JPY = 0.000015
export const GEMINI_COST_PER_COMPLETION_TOKEN_JPY = 0.00006

// 変更後（Gemini 2.5 Flash: $0.15/1M prompt, $0.60/1M completion, 150JPY/USD）
export const GEMINI_COST_PER_PROMPT_TOKEN_JPY = 0.0000225
export const GEMINI_COST_PER_COMPLETION_TOKEN_JPY = 0.00009
```

### WARNING-2: 月解決をUTCからJSTに変更

**ファイル**: `cloudflare-api/src/handlers/gemini-usage.ts`
**場所**: `resolveCurrentMonth()` L21-23

UTC基準だとJSTとの9時間ずれで月初/月末のカウントがずれる。

修正:
```typescript
// 変更前
function resolveCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

// 変更後
function resolveCurrentMonth(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 7)
}
```

### WARNING-3: recordGeminiUsage 失敗時のエラーハンドリング

**ファイル**: `cloudflare-api/src/handlers/food.ts` と `cloudflare-api/src/handlers/report.ts`

usage記録の失敗がメイン処理を巻き込んでthrowする。Gemini呼び出し成功後のusage記録失敗で分析結果/レポートが失われるのは望ましくない。

修正（food.ts）:
```typescript
// recordGeminiUsage 呼び出し箇所を try-catch で囲む
try {
  await recordGeminiUsage(env.DB, result.promptTokens, result.completionTokens)
} catch {
  // usage tracking failure should not block response delivery
}
```

修正（report.ts）:
```typescript
if (provider === 'gemini') {
  try {
    await recordGeminiUsage(env.DB, generated.prompt_tokens ?? 0, generated.completion_tokens ?? 0)
  } catch {
    // usage tracking failure should not block report delivery
  }
}
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/report.ts` | APIキーをヘッダーに移行 + recordGeminiUsage try-catch |
| `cloudflare-api/src/constants.ts` | トークン単価更新 |
| `cloudflare-api/src/handlers/gemini-usage.ts` | resolveCurrentMonth JST対応 |
| `cloudflare-api/src/handlers/food.ts` | recordGeminiUsage try-catch |

## Acceptance Criteria

1. report.ts のGemini API呼び出しURLに `?key=` が含まれない
2. トークン単価が `0.0000225` / `0.00009` に更新されている
3. `resolveCurrentMonth()` がJST基準で月を返す
4. recordGeminiUsage が失敗しても食事解析/レポート生成の結果が返却される
5. TypeScript ビルドが通る
