# Request: Gemini API 月額上限制御（H4）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `open`
- Phase: H（ハルUX v2）
- Depends on: H3
- Priority: 高

## 概要

Gemini API呼び出しに月額1000円の上限を設ける。上限超過時はAPI呼び出しを停止し、ユーザーにエラーを返す。食事解析（food.ts）とレポート生成（report.ts）の両方が対象。

## DBマイグレーション

**ファイル**: `cloudflare-api/migrations/0011_gemini_usage.sql`

```sql
CREATE TABLE IF NOT EXISTS gemini_usage_monthly (
  month TEXT PRIMARY KEY,           -- YYYY-MM
  total_calls INTEGER NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  total_completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_jpy REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 料金計算

Gemini 2.0 Flash / 2.5 Flash の料金（概算、1 USD = 150 JPY）:

```typescript
// 定数定義（cloudflare-api/src/constants.ts に追加）
const GEMINI_COST_PER_PROMPT_TOKEN_JPY = 0.000015    // $0.10/1M tokens * 150
const GEMINI_COST_PER_COMPLETION_TOKEN_JPY = 0.00006  // $0.40/1M tokens * 150
const GEMINI_MONTHLY_LIMIT_JPY = 1000
```

※ 画像入力はトークン数に含まれるのでGeminiレスポンスの `usageMetadata.promptTokenCount` から自動的に計算される。

## 実装

### 共通モジュール: `cloudflare-api/src/handlers/gemini-usage.ts`（新規）

food.tsとreport.tsの両方から呼ばれる共通ユーティリティ:

```typescript
import type { D1Database } from '../types'

// 月別の使用量を取得
export async function getMonthlyUsage(db: D1Database, month: string): Promise<{
  totalCalls: number
  estimatedCostJpy: number
}> {
  // SELECT from gemini_usage_monthly WHERE month = ?
}

// 月額上限チェック（呼び出し前に実行）
export async function checkMonthlyLimit(db: D1Database): Promise<{
  ok: boolean
  currentCostJpy: number
  limitJpy: number
}> {
  const month = new Date().toISOString().slice(0, 7)  // YYYY-MM
  const usage = await getMonthlyUsage(db, month)
  return {
    ok: usage.estimatedCostJpy < GEMINI_MONTHLY_LIMIT_JPY,
    currentCostJpy: usage.estimatedCostJpy,
    limitJpy: GEMINI_MONTHLY_LIMIT_JPY,
  }
}

// 使用量を記録（呼び出し後に実行）
export async function recordGeminiUsage(
  db: D1Database,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)
  const cost = promptTokens * GEMINI_COST_PER_PROMPT_TOKEN_JPY
             + completionTokens * GEMINI_COST_PER_COMPLETION_TOKEN_JPY
  // UPSERT: INSERT ... ON CONFLICT(month) DO UPDATE SET
  //   total_calls = total_calls + 1,
  //   total_prompt_tokens = total_prompt_tokens + ?,
  //   total_completion_tokens = total_completion_tokens + ?,
  //   estimated_cost_jpy = estimated_cost_jpy + ?,
  //   updated_at = datetime('now')
}
```

### food.ts の変更

`callGeminiFoodAnalyze()` の戻り値にトークン情報を追加し、`handleFoodAnalyze()` で:

1. **呼び出し前**: `checkMonthlyLimit(env.DB)` → NGなら `429` を返却
2. **呼び出し後**: `recordGeminiUsage(env.DB, promptTokens, completionTokens)` で記録

```typescript
// handleFoodAnalyze() 内、Gemini呼び出し前に追加
const limitCheck = await checkMonthlyLimit(env.DB)
if (!limitCheck.ok) {
  return jsonResponse({
    detail: 'Gemini API の月額上限に達しました。食品DBからの検索は引き続き利用できます。',
    current_cost_jpy: limitCheck.currentCostJpy,
    limit_jpy: limitCheck.limitJpy,
  }, 429)
}

// Gemini呼び出し後に追加
await recordGeminiUsage(env.DB, result.promptTokens, result.completionTokens)
```

### report.ts の変更

`callGeminiPlainText()` 呼び出し箇所（`callLlmPlainText()` 内）で同様に:

1. **呼び出し前**: `checkMonthlyLimit(env.DB)` → NGなら呼び出しスキップ（エラー返却）
2. **呼び出し後**: `recordGeminiUsage()` で記録

注意: report.ts では `callLlmPlainText()` が provider を判定して Gemini/OpenAI を切り替えている。provider === 'gemini' の場合のみ制御すること。

### GET /api/gemini-usage（任意）

現在の使用状況を確認するエンドポイント:

```
GET /api/gemini-usage
→ { month: "2026-03", total_calls: 42, estimated_cost_jpy: 123.45, limit_jpy: 1000 }
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/migrations/0011_gemini_usage.sql` | gemini_usage_monthly テーブル作成 |
| `cloudflare-api/src/constants.ts` | 料金定数・月額上限定数を追加 |
| `cloudflare-api/src/handlers/gemini-usage.ts` | 新規: 使用量チェック・記録ユーティリティ |
| `cloudflare-api/src/handlers/food.ts` | 呼び出し前チェック + 呼び出し後記録 |
| `cloudflare-api/src/handlers/report.ts` | 呼び出し前チェック + 呼び出し後記録 |
| `cloudflare-api/src/index.ts` | GET /api/gemini-usage ルート追加 |

## 制約

1. DB検索（`source: "db"`）は制限対象外。Gemini API呼び出しのみカウント
2. report.ts の OpenAI 呼び出しは制限対象外（provider === 'gemini' のみ）
3. 月の区切りはUTC基準（`new Date().toISOString().slice(0, 7)`）
4. TypeScript ビルドが通ること

## Acceptance Criteria

1. 食事解析でGemini API呼び出し後に gemini_usage_monthly にトークン数・コストが記録される
2. レポート生成でGemini API呼び出し後に同様に記録される
3. 月額上限（1000円）超過時に食事解析が429エラーを返し、Gemini APIが呼ばれない
4. 月額上限超過時にレポート生成もエラーを返す
5. DB検索（food_items）は上限超過時も利用可能
6. GET /api/gemini-usage で現在の使用状況が確認できる
7. TypeScript ビルドが通る
