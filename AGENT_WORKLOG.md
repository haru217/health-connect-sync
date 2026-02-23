# AGENT_WORKLOG

全エージェント共通の作業ログです。  
レポート作成時はまずこのファイルを参照します。

## 運用ルール

1. エージェントは作業完了ごとに1エントリ追記する。
2. 追記は「上に新規追加（新しい順）」で管理する。
3. 最低限、`日付` `担当` `要約` `関連コミット` `本番反映有無` を書く。
4. 既存エントリは削除しない（訂正は追記で行う）。

## 記載テンプレート

```md
### YYYY-MM-DD
- 担当: Codex | Gemini | Claude | Other
- 要約: 
- 変更ファイル: 
- 関連コミット: 
- デプロイ: Vercel/Fly/GitHub Actions など
- メモ:
```

## ログ

### 2026-02-23
- 担当: Codex
- 要約: ユーザー指示で1回実行（前日データ + 吉野家牛丼大盛り3杯仮定）の途中で中止。次セッションで同条件を再実行する。
- 変更ファイル: `AGENT_WORKLOG.md`
- 関連コミット: なし（未コミット）
- デプロイ: なし
- メモ: 再開時は `automation/codex_task_prompt_once_daily.txt` を使って one-shot 実行。条件は「dailyのみ」「JST昨日」「摂取不足時に牛丼大盛り3杯仮定」。

### 2026-02-23
- 担当: Codex
- 要約: cronレポート生成条件を更新。`daily` は毎日、`weekly` は月曜のみ（前週月〜日）、`monthly` は毎月1日のみ（前月）で作成するルールに変更。
- 変更ファイル: `automation/codex_task_prompt.txt`, `AGENT_WORKLOG.md`
- 関連コミット: なし（未コミット）
- デプロイ: なし
- メモ: `report_date` は daily=昨日、weekly=前週日曜、monthly=前月末日に統一。

### 2026-02-23
- 担当: Codex
- 要約: cron用プロンプトをdaily/weekly/monthly一括生成仕様へ更新。`ai_reports` は同一 `report_date + report_type` を最新1件に更新するよう修正。AI画面に履歴一覧（過去週・過去月含む）を追加。
- 変更ファイル: `automation/codex_task_prompt.txt`, `automation/run_codex_task.ps1`, `pc-server/app/reports.py`, `pc-server/tests/test_main_ai_endpoints.py`, `web-app/src/screens/AiScreen.tsx`, `web-app/src/screens/AiScreen.css`, `AGENT_WORKLOG.md`
- 関連コミット: なし（未コミット）
- デプロイ: なし（ローカル実装・テストのみ）
- メモ: `report_type` は API制約に合わせて `daily|weekly|monthly` を使用。Step1失敗時は全体中止、NotebookLM個別失敗は `（回答取得失敗）` として継続。

### 2026-02-23
- 担当: Codex
- 要約: `mcp_servers.memory` の有効化状態を確認（`enabled: true`）。メモリ保存先環境変数付きで稼働中であることを確認。
- 変更ファイル: `AGENT_WORKLOG.md`
- 関連コミット: なし（未コミット）
- デプロイ: なし
- メモ: `codex mcp get memory` の結果で `@modelcontextprotocol/server-memory` と `MEMORY_FILE_PATH` を確認。

### 2026-02-23
- 担当: Codex
- 要約: Codex向けMCP 5種（memory/context7/github/playwright/sentry）を導入し、非対話の定期実行（Windowsタスクスケジューラ）を設定。`TASK.md` の進捗も最新化。
- 変更ファイル: `TASK.md`, `automation/codex_task_prompt.txt`, `automation/run_codex_task.ps1`, `automation/register_codex_task.ps1`, `AGENT_WORKLOG.md`
- 関連コミット: なし（未コミット）
- デプロイ: なし（ローカル設定・運用基盤整備）
- メモ: タスク名は `HealthConnectSync-Codex`、毎日09:00実行。ログは `automation/logs/` に出力。

### 2026-02-23
- 担当: Codex
- 要約: HealthタブBMR表示を「総消費-活動カロリーから推定（取得不可時は1670固定）」へ変更。
- 変更ファイル: `web-app/src/screens/HealthScreen.tsx`
- 関連コミット: `eb0f944`
- デプロイ: `web-app-jet-chi.vercel.app` へ本番反映済み（`npx vercel --prod --yes`）
- メモ: Health Connect実測BMR（`bmrByDate`）は現状空のため、表示ロジックで補完。

### 2026-02-23
- 担当: Codex
- 要約: BMR表示を1670固定化（一時対応）し、式推定表示を除去。
- 変更ファイル: `pc-server/app/summary.py`, `web-app/src/screens/HealthScreen.tsx`
- 関連コミット: `4626973`
- デプロイ: Vercel本番反映済み
- メモ: 後続で「総消費-活動」方式へ置き換え（`eb0f944`）。

### 2026-02-23
- 担当: Codex
- 要約: 2/22消費カロリー低表示の原因修正（`totalCaloriesByDate` 優先）と、運動グラフタップ時の黒枠抑制。
- 変更ファイル: `web-app/src/screens/HomeScreen.tsx`, `web-app/src/screens/ExerciseScreen.tsx`, `web-app/src/screens/MealScreen.tsx`, `web-app/src/screens/ExerciseScreen.css`
- 関連コミット: `326c578`
- デプロイ: Vercel本番反映済み
- メモ: APIの `totalCalByDate` は生値で、`totalCaloriesByDate` は補正済み値。

### 2026-02-23
- 担当: Codex
- 要約: Healthタブの画像サイズ崩れ、BMR未定義エラー、開発時SWキャッシュ問題、SpO2日本語化を修正。
- 変更ファイル: `web-app/src/main.tsx`, `web-app/src/screens/HealthScreen.css`, `web-app/src/screens/HealthScreen.tsx`, `web-app/src/screens/HomeScreen.tsx`
- 関連コミット: `9628243`
- デプロイ: Vercel本番反映済み
- メモ: 開発時はService Workerを解除する挙動へ変更。

### 2026-02-22
- 担当: Codex
- 要約: STEP7のPNG差し替え方針を中止し、SVG継続を正式化。HomeのAIコメント位置を他タブに合わせて統一。
- 変更ファイル: `CODEX_STEP7_ICONS.md`, `TASK.md`, `web-app/src/screens/HomeScreen.css`
- 関連コミット: `de95d53`
- デプロイ: ドキュメント変更中心（必要時にVercel反映）
- メモ: STEP7(PNG)は「中止」、SVG運用を採用。
