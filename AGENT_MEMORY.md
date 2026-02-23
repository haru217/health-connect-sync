# AGENT MEMORY

Last updated: 2026-02-23

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

## 2026-02-23: インフラ移行・AI 自動化

### Fly.io → Google Cloud 移行（完了）
- GCP プロジェクト: `health-ai-ryosuzu`
- VM: `health-ai-vm`（e2-micro / us-central1-a / 外部 IP: 34.123.119.197）
- Docker Compose + Caddy（自動 HTTPS）で FastAPI 起動
- nip.io ドメイン: `https://34.123.119.197.nip.io`
- SQLite DB 移行完了（13,415件）
- **注意**: 外部 IP が静的化されていない場合、VM 再起動で IP が変わる

### API URL 変更（完了）
- `web-app/.env.production.vercel`: `VITE_API_URL` → `https://34.123.119.197.nip.io`
- `android-sync/.../AppConfig.kt`: `SERVER_BASE_URL` → `https://34.123.119.197.nip.io`
- Vercel 再デプロイ完了: https://web-app-jet-chi.vercel.app
- Android: GitHub Actions でビルド（`android-sync` push でトリガー）

### NotebookLM + Codex 自動化（完了）
- NotebookLM 3ノートブック登録（フィジカルトレーナー・管理栄養士・医師）
- `~/.codex/config.toml` に `notebooklm-mcp` 追加
- `sandbox_mode = "danger-full-access"` に変更（curl ブロック解消）
- `automation/codex_task_prompt.txt` を daily/weekly/monthly 対応版に更新
- 3ノートブックに同じフルデータを渡し、質問（役割）のみ変える設計

### 残タスク
- [ ] GCP 外部 IP を静的化（再起動で IP 変わると nip.io が壊れる）
- [ ] Fly.io 削除（`flyctl apps destroy user-purple-hill-1159`）
- [ ] Codex NotebookLM MCP 初回認証確認（次回 cron 実行時）

## Restart prompt (copy in new session)
`C:\\Users\\user\\health-connect-sync\\AGENT_MEMORY.md` を読んで、続きから実装して。
