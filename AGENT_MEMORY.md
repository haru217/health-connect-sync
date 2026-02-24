# AGENT MEMORY

> [!IMPORTANT]
> **2026-02-24 時点のインフラ状況**
> - Fly.io: 廃止済み（`user-purple-hill-1159` 削除完了）
> - GCP VM: 廃止済み（Cloudflare 系サーバーに移管済み）
> - 旧 URL `https://34.171.85.174.nip.io` は無効
> - 新サーバー URL は設定画面・各 AppConfig で確認すること

Last updated: 2026-02-24

## Current focus
- Sleep day-bucketing fix has been implemented and validated by tests.
- Next practical check is visual verification on Home once real `SleepSessionRecord` data is synced.

## What is now confirmed
- Home UI reads `sleepHoursByDate` for the selected date.
- Sleep aggregation in `pc-server/app/summary.py` uses wake-up day bucketing via `_sleep_bucket_day(...)`.
- Bucketing priority is: `endZoneOffset` -> `startZoneOffset` -> local timezone day of `end_time`.
- Zone offset parsing supports numeric seconds, `+09:00` style strings, and nested objects (`{"totalSeconds": ...}`).
- Regression tests exist in `pc-server/tests/test_summary_sleep_bucketing.py` (4 cases).

## Latest verification
1. Ran: `python -m unittest tests/test_summary_sleep_bucketing.py` (OK, 4 tests).
2. Ran: `python -m unittest tests/test_summary_sleep_bucketing.py tests/test_main_ai_endpoints.py` (OK, 10 tests).
3. Checked local DB (`pc-server/hc_sync.db`): currently `SleepSessionRecord` count is 0, so real-record date spot-check is pending until next sync.

## Next implementation step
1. Sync actual sleep records from Android (Health Connect).
2. Verify `/api/summary` -> `sleepHoursByDate` date labels on Home for one known night sleep sample.
3. If mismatch remains, inspect incoming payload offsets (`endZoneOffset`, `startZoneOffset`) from stored sleep records.

## React skill installed
- `vercel-react-best-practices` was installed globally via `npx skills add`.
- To ensure full pickup, restart Codex before continuing work.

---

## ~~2026-02-23: Fly.io → GCP 移行~~（アーカイブ）

> この移行はさらに Cloudflare 系サーバーへ移管済み。詳細は `_archive/old-infra-docs/` 参照。

### NotebookLM + Codex 自動化（完了）
- NotebookLM 3ノートブック登録（フィジカルトレーナー・管理栄養士・医師）
- `~/.codex/config.toml` に `notebooklm-mcp` 追加
- `sandbox_mode = "danger-full-access"` に変更（curl ブロック解消）
- `automation/codex_task_prompt.txt` を daily/weekly/monthly 対応版に更新
- 3ノートブックに同じフルデータを渡し、質問（役割）のみ変える設計

### 残タスク
- [x] Android AppConfig.kt 更新 → push → GitHub Actions でビルドトリガー済み
- [x] Vercel 再デプロイ → https://web-app-jet-chi.vercel.app
- [ ] **新サーバー URL を AppConfig.kt / SettingsScreen.kt に反映**（Cloudflare 移管後）
- [ ] Codex NotebookLM MCP 初回認証確認（次回 cron 実行時）
- [ ] Android APK ダウンロード（GitHub Actions 完了後）→ `adb install -r app-debug.apk`

---

## Codex 自動タスク（毎日 09:00 cron）

タスクプロンプト: `automation/codex_task_prompt.txt`
実行スクリプト: `automation/run_codex_task.ps1`（stdin パイプ方式）
タスクスケジューラ: `HealthConnectSync-Codex`（WakeToRun: true）

### Codex が毎日やること
1. GCP サーバー（`https://34.171.85.174.nip.io`）に接続してヘルスサマリー取得
2. NotebookLM MCP 経由で3ノートブックに質問（フィジカルトレーナー・管理栄養士・医師）
3. アドバイスを Discord #体調管理 に自動送信（Discord Webhook）
4. 進捗を GitHub にコミット・push（GitHub MCP）

### Codex の次回タスク（未完了）
- [ ] NotebookLM MCP の初回 Playwright 認証フロー確認（ブラウザが起動するか要確認）
- [ ] Discord Webhook URL が `.env` に設定されているか確認・送信テスト
- [ ] 週次レポート（月曜）・月次レポート（1日）の動作確認

---

## 他エージェント・自動化タスク

### GitHub Actions（CI/CD）
- `android-app-build.yml`: android-app/ push → Debug APK ビルド（main/master ブランチ）
- `android-sync-build.yml`: android-sync/ push → Debug APK ビルド
- 成果物: GitHub Actions Artifacts からダウンロード可能

### android-app（Health Connect 同期）
- WorkManager で 1 時間ごとに自動同期（`SyncWorker`）
- サーバー URL: `https://34.171.85.174.nip.io`（固定値、SettingsScreen で API キーのみ設定）
- API キー: `test12345`（初期デフォルト値）
- SecurityException 発生時は該当レコードタイプをスキップして続行

### GCP VM 運用
- `gcloud compute instances start/stop health-ai-vm --zone us-central1-a`
- Docker Compose 起動: `docker compose up -d`（`/opt/health-ai/docker-compose.yml`）
- ログ確認: `docker compose logs -f app`

## Restart prompt (copy in new session)
`C:\\Users\\user\\health-connect-sync\\AGENT_MEMORY.md` を読んで、続きから実装して。

