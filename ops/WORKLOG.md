# Worklog (New Canonical)

Use this log for all new entries going forward.

Legacy note:
- `AGENT_WORKLOG.md` is preserved, but new entries should be recorded here.

## Entry format
### YYYY-MM-DD
- Owner:
- Scope:
- Result:
- Files:
- Risk/Follow-up:

### 2026-02-26
- Owner: Codex (CTO代行)
- Scope: ダッシュボードをAPI連結集中モードへ再更新
- Result: `P1-2-*` を `todo` に戻し、`in_progress` を `P1-1-5` + `I1` + `I2` のみに限定。優先バッジも Home/Condition 関連のみを最優先表示へ統一。
- Files: `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Home/Condition の最終決裁前に他タスクへ拡散しない運用を継続する。

### 2026-02-26
- Owner: Codex (CTO代行)
- Scope: 優先順位の再定義（Cloudflare連結最優先、Home/Condition決裁待ち、Profile後回し）
- Result: CEO指示に合わせてダッシュボードの順序を更新。`P1-1-5` を in_progress に戻し、`I1/I2` を最優先 in_progress、`I3/I4` を次フェーズ todo、`I5`（プロフィール）を後順位 todo に調整。
- Files: `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Home/Condition の最終決裁後に `I3`（アクティビティ）→`I4`（食事）へ進み、最後に `I5` を再開する。

### 2026-02-26
- Owner: Claude (PMO)
- Scope: ホームタブ改修の実装状況調査
- Result: cloudflare-api に /api/home-summary（注目ポイント・数値付き充足度）が未実装であることを発見。pc-server には実装済み。CEO の認識と実態にギャップあり。Codex 向けタスクとハンドオフを作成した。
- Files: `requests/codex/20260226-home-summary-cloudflare-api.md`, `handoff/incoming/20260226-claude-home-summary-gap.md`
- Risk/Follow-up: フロントエンドが cloudflare-api を向いている場合、ホームタブの主要機能が現在未動作の可能性あり。早急に Codex が対応する必要がある。

### 2026-02-26
- Owner: Codex
- Scope: Condition tab data-completion (backend derivation + frontend rendering hookup)
- Result: Added derivation/fallback logic for sleep stages, bedtime/wake time, BMR, and resting HR; enabled aggregate refresh on condition endpoints; updated HealthScreen to render BMR, resting HR chart line, high BP count, stage ratios, and goal-day rate. Fixed body current-value lookup to avoid blank weight/body-fat when selected day has only BMR. Added BMR sanity filter to reject invalid observed values (e.g. 35 kcal/day) and fallback to estimate.
- Files: `cloudflare-api/src/index.ts`, `web-app/src/screens/HealthScreen.tsx`, `web-app/src/api/types.ts`, `requests/codex/20260226-condition-backend-null-fill.md`, `handoff/incoming/20260226-codex-condition-backend-null-fill.md`
- Risk/Follow-up: Validate with real user data for year-period aggregation semantics (monthly bucket + daily-derived ratios).
### 2026-02-26
- Owner: Codex
- Scope: Home API completion (`/api/home-summary`) and local D1 dev stabilization
- Result: Added `GET /api/home-summary?date=YYYY-MM-DD` to `cloudflare-api` with `sufficiency`, `statusItems`, `attentionPoints`, `report`, and `previousReport`. Fixed local dev `500` (`D1_ERROR: Failed to parse body as JSON, error code: 1031`) by switching D1 binding from remote proxy mode to local mode in `wrangler.toml`. Verified previously failing endpoints now return `200`.
- Files: `cloudflare-api/src/index.ts`, `cloudflare-api/wrangler.toml`, `handoff/incoming/20260226-codex-home-summary-and-d1-dev-fix.md`, `ops/CEO_DASHBOARD.html`
- Risk/Follow-up: Local dev now uses local D1 by default. If remote data is needed for validation, run explicit `wrangler d1 execute --remote` or introduce a dedicated remote-dev profile.
### 2026-02-26
- Owner: Codex
- Scope: HealthScreen Recharts chart-size warning fix
- Result: Removed chart container sizing warning risk by adding `minWidth/minHeight` to all `ResponsiveContainer` in Health tabs and enforcing `min-width: 0` on chart wrappers.
- Files: `web-app/src/screens/HealthScreen.tsx`, `web-app/src/screens/HealthScreen.css`, `handoff/incoming/20260226-codex-healthscreen-chart-size-warning.md`
- Risk/Follow-up: Re-check browser console after hot reload to ensure warning is fully gone in `composition`, `circulation`, and `sleep` tabs.

### 2026-02-26
- Owner: Codex-1
- Scope: P1-1-5 Web app Cloudflare API connection completion
- Result: Removed frontend fallback/mock returns in `web-app/src/api/healthApi.ts` for `home-summary/body/sleep/vitals` and made Cloudflare API the single source. Updated HealthScreen chart containers to numeric height to avoid `width(-1)/height(-1)` warning condition. Local smoke run (`wrangler dev`) confirmed all required endpoints return `200`.
- Files: `web-app/src/api/healthApi.ts`, `web-app/src/screens/HealthScreen.tsx`, `ops/CEO_DASHBOARD.html`, `handoff/incoming/20260226-codex-web-app-cloudflare-connect.md`
- Risk/Follow-up: `ops/update-ceo-dashboard-task.ps1` is currently broken (mojibake parse error), so dashboard update was applied directly to HTML. Repair script before next status update.

### 2026-02-26
- Owner: Codex-1
- Scope: Home / Condition ローカル最終確認（Cloudflare API 接続）
- Result: `wrangler dev` + `web-app` 環境で Home/Condition の画面表示・API反映を再確認。Playwrightでスクリーンショットと console/network ログを採取し、決裁用チェックリストと未解決事項を handoff に整理。`P1-1-5` は指示どおり `in_progress` 維持。
- Files: `handoff/incoming/20260226-codex1-home-condition-final-check.md`, `web-app/qa/20260226-home-condition/*`
- Risk/Follow-up: Home初期日付とseed日付のズレ時に一部 `-` 表示。専門家セクションのタグ表示（`<!--DOCTOR-->` 等）は別途仕様判断が必要。

### 2026-02-26
- Owner: Codex2
- Scope: Home/Condition向け Cloudflare API 契約の確定（レスポンス項目・エラー挙動・サンプル・ギャップ整理）
- Result: `/api/home-summary`, `/api/body-data`, `/api/sleep-data`, `/api/vitals-data` の契約をコード実装と実レスポンス採取で確定し、`/api/summary` 依存有無を明記。主要エラー（400/404/500、認証条件）とギャップ一覧を handoff に整理。`P1-1-5` は in_progress 維持で、ダッシュボード状態は変更していない。
- Files: `handoff/incoming/20260226-codex2-home-condition-api-contract.md`, `ops/WORKLOG.md`
- Risk/Follow-up: `latestSleepDate` が API 実レスポンスに存在する一方で `web-app/src/api/types.ts` の `SleepDataResponse` に未定義。必要なら型へ追随させる。
