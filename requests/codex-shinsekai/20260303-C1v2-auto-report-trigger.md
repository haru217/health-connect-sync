# Request: データ同期後のレポート自動生成（C1v2）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: C（AI）
- Depends on: C1（完了済み）

## Background
C1で実装した日次レポート生成（`POST /api/report/generate`）は現在手動呼び出しのみ。
CEO決定により、Androidからのデータ同期完了後に自動でレポートを生成する。

## 要件

### 1. `handleSync` 完了後にレポート生成をトリガー
- `POST /api/sync` の処理成功後、当日分のレポートを自動生成する
- **同期レスポンスをブロックしない**: `waitUntil` を使ってバックグラウンドで実行
- 既にキャッシュがある日はスキップ（`force: false`）
- LLM_API_KEY が未設定の場合はスキップ（エラーにしない）

### 2. 対象日の決定
- **当日分（JST基準）のみ生成する** — 過去分は自動生成しない
- 判定: `toIsoDate(new Date())` と比較し、当日であればレポート生成
- 過去分のレポートが必要な場合は `POST /api/report/generate` で手動生成
- 理由: 過去データの一括同期時に大量のLLM呼び出しが発生するのを防ぐ

### 3. エラーハンドリング
- レポート生成の失敗は同期レスポンスに影響させない
- エラーは `console.error` でログ出力のみ
- タイムアウト・APIエラー等は握りつぶしてOK（次回同期時に再試行される）

## 実装場所

### `handleSync` 関数（4872行付近）
現在の最後:
```typescript
return jsonResponse({
  accepted: true,
  upsertedCount: upserted,
  skippedCount: skipped,
})
```

変更後（イメージ）:
```typescript
// レポート自動生成（当日分のみ、バックグラウンド）
const today = toIsoDate(new Date())
const llmApiKey = (env.LLM_API_KEY ?? '').trim()
if (llmApiKey && ctx) {
  ctx.waitUntil(
    generateDailyReportIfNeeded(env, today).catch((err) =>
      console.error('Auto report generation failed:', err)
    )
  )
}

return jsonResponse({
  accepted: true,
  upsertedCount: upserted,
  skippedCount: skipped,
})
```

### `generateDailyReportIfNeeded` 関数（新規）
- `getDailyReport(db, date)` でキャッシュ確認
- キャッシュなし → `handleDailyReportGenerate` の内部ロジックを呼ぶ
- 既存の `handleDailyReportGenerate` から生成ロジックを抽出してリファクタリングしてもよい

### `ctx` (ExecutionContext) の受け渡し
- 現在 `handleSync` は `(request, env)` のみ受け取っている
- `waitUntil` を使うために `ctx: ExecutionContext` を追加で渡す必要がある
- Workers の `fetch` ハンドラーの引数から `ctx` を各ハンドラーに渡すよう修正

## モデル設定
- デフォルトプロバイダ: `anthropic`（env.LLM_PROVIDER）
- デフォルトモデル: `claude-haiku-4-5-20251001`（env.LLM_MODEL）
- 既存の環境変数設定をそのまま使用

## Acceptance Criteria
1. `POST /api/sync` 成功後、バックグラウンドでレポートが自動生成される
2. 同期レスポンスの速度に影響しない（waitUntil使用）
3. 既にレポートがある日は再生成しない
4. LLM_API_KEY 未設定時はスキップ（エラーなし）
5. レポート生成失敗時も同期レスポンスは正常に返る
6. 既存の `POST /api/report/generate`（手動）は引き続き動作する
