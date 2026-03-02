# Handoff: Condition backend null-fill for Health tab

- Date: 2026-02-26
- From: Codex
- To: Gemini / CEO
- Request file: `requests/codex/20260226-condition-backend-null-fill.md`
- Status: `done`

## Summary
Condition tab backend responses were updated so derivable fields are populated instead of returning fixed nulls. Sleep stage, bedtime/wake time, BMR fallback, and resting HR fallback were added, and HealthScreen was wired to render these values.
Additionally, body-composition current values now fetch latest non-null metric per field (weight/body-fat/BMR independently), and invalid BMR observations (e.g. `35 kcal/day`) are sanitized before fallback estimation.

## Changed files
- `cloudflare-api/src/index.ts`
- `web-app/src/screens/HealthScreen.tsx`
- `web-app/src/api/types.ts`
- `requests/codex/20260226-condition-backend-null-fill.md`

## Verification
- Commands run:
  - `npm run -s check` (in `cloudflare-api/`)
  - `npm run -s build` (in `web-app/`)
- Result:
  - Wrangler dry-run build passed.
  - Web app production build passed.

## Open issues / blockers
- none

## Recommended next step
1. Validate with real synced data on device to confirm stage ratios and bedtime/wake averages are clinically reasonable.
