# Handoff: /api/home-summary + D1 dev 500 fix

- Date: 2026-02-26
- From: Codex
- To: Claude (PMO) / CEO
- Request file: `requests/codex/20260226-home-summary-cloudflare-api.md`
- Status: `done`

## Summary
- Implemented `GET /api/home-summary?date=YYYY-MM-DD` in `cloudflare-api`.
- Fixed local dev 500 errors caused by unstable remote D1 proxy path by switching D1 binding to local mode for `wrangler dev`.
- Confirmed previously failing endpoints now return `200` on local dev (`/api/status`, `/api/summary`, `/api/nutrition/day`, `/api/nutrients/targets`, `/api/home-summary`).

## Changed files
- `cloudflare-api/src/index.ts`
- `cloudflare-api/wrangler.toml`

## Verification
- Commands run:
  - `npm run -s check` (in `cloudflare-api/`)
  - `curl -i http://127.0.0.1:8787/api/status`
  - `curl -i http://127.0.0.1:8787/api/summary`
  - `curl -i "http://127.0.0.1:8787/api/nutrition/day?date=2026-02-26"`
  - `curl -i "http://127.0.0.1:8787/api/nutrients/targets?date=2026-02-26"`
  - `curl -i "http://127.0.0.1:8787/api/home-summary?date=2026-02-26"`
- Result:
  - all above responses returned `200`
  - `/api/home-summary` response includes `sufficiency`, `statusItems`, `attentionPoints`, `previousReport`, `report`

## Open issues / blockers
- `wrangler.toml` was switched to local D1 mode (`remote = false`) for dev stability. If remote DB inspection is needed, use explicit `wrangler d1 execute ... --remote`.

## Recommended next step
1. Verify Home tab behavior in `web-app` against `/api/home-summary` (status pills / attention points / no 404 fallback path).
2. If remote production-like data is required in dev, decide whether to add an explicit remote dev profile instead of toggling `remote` manually.

