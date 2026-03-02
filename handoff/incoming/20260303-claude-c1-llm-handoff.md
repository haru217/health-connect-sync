# 引継ぎ: C1 AIレポートAPI — LLMテスト＆品質調整

- Date: 2026-03-03
- From: Claude (CTO)
- To: 次のClaudeセッション
- Status: `in_progress`

## 現在の状態

C1（AIレポート日次生成API）は**実装・デプロイ済み**。LLM APIキーのクレジット不足で**動作確認が未完了**。

## 完了済み

1. Codex-shinsekaiがC1を実装（コミット `2bb881b`）
2. CTOレビュー実施 → プロンプトのキャラ定義強化（`29fe21a`）
3. プロンプト全面設計し直し（`6f4275a`）
   - System Prompt: アプリの役割・絶対ルール（事実ベース、否定禁止、null skip）
   - User Prompt: データの意味を解説、キャラごとに担当・トーン・発言例を付与
   - タブコメントの担当を明記（condition=ユウ先生、activity=マイコーチ、meal=サキさん）
   - headlineの文字数指定（15〜30文字）
   - ハルシネーション防止ルール
4. Anthropicエラー詳細をレスポンスに含める改修（`be2b600`）
5. 本番デプロイ済み（Workers + D1 migration 0009）

## 残タスク

### 1. Anthropicクレジット追加待ち
- CEOがAnthropicコンソールで$5クレジット追加中
- 追加後に以下を実行して動作確認:
```bash
curl -sk -X POST "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/report/generate" \
  -H "X-Api-Key: test12345" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-02"}'
```

### 2. 生成品質の確認
- レスポンスが返ったら `GET /api/report?date=2026-03-02` でキャッシュ確認
- 確認ポイント:
  - 各コメント80〜150文字か
  - 3キャラの口調が区別できるか
  - 絵文字が含まれていないか
  - headlineが15〜30文字か
  - データに基づいた事実のみか（ハルシネーションなし）
- 品質が悪い場合はプロンプト調整（`buildDailyReportPrompt` 関数、3860行付近）

### 3. 品質OKなら次へ
- ダッシュボードにC1タスクを追加（現在TASKS配列にC1がない）
- WORKLOGにCTOレビュー＆プロンプト設計の記録追加

## Cloudflare Workers シークレット状態
- `API_KEY`: 設定済み（`test12345`）
- `LLM_API_KEY`: 設定済み（Anthropic `sk-ant-...`）— クレジット不足で400エラー
- `LLM_MODEL`: 未設定（デフォルト `claude-haiku-4-5-20251001` が使われる）
- `LLM_PROVIDER`: 未設定（デフォルト `anthropic` が使われる）

## 未コミット変更（引継ぎ時点）
```
 M ops/archive/CEO_DASHBOARD.html
 M requests/codex/20260302-A1-rule-engine-scores.md
 M requests/gemini/20260302-B1-home-screen-scores.md
?? UI-image/avatars/
?? gpt壁打ち.md
?? requests/codex-shinsekai/20260303-A1v2-scoring-redesign.md
?? requests/gemini/20260303-B1-home-screen-scores.md
```
これらはC1とは無関係。CEO側の作業ファイル。

## 関連ファイル
- 仕様: `requests/codex/20260303-C1-llm-daily-report.md`
- 実装: `cloudflare-api/src/index.ts` (3849行〜 `buildDailyReportPrompt`, 3946行〜 `callAnthropicDailyReport`)
- マイグレーション: `cloudflare-api/migrations/0009_daily_reports.sql`
- エンドポイント: `GET /api/report?date=YYYY-MM-DD`, `POST /api/report/generate`
