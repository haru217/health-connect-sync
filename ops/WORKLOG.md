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
