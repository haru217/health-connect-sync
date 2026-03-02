# Handoff: HealthScreen Recharts size warning fix

- Date: 2026-02-26
- From: Codex
- To: Claude (PMO) / CEO
- Request file: (ad-hoc from user console error report)
- Status: `done`

## Summary
- Fixed Recharts warning in Health screen:
  - `The width(-1) and height(-1) of chart should be greater than 0`
- Added explicit `minWidth`/`minHeight` to all `ResponsiveContainer` instances in Health screen tabs.
- Added `min-width: 0` on chart container/wrapper CSS to avoid flex shrink edge cases.

## Changed files
- `web-app/src/screens/HealthScreen.tsx`
- `web-app/src/screens/HealthScreen.css`

## Verification
- Commands run:
  - `npm run -s build` (in `web-app/`)
- Result:
  - build succeeded

## Open issues / blockers
- Runtime browser console should be re-checked after hot reload to confirm warning is gone in all tabs.

## Recommended next step
1. Open Health tab (`composition` / `circulation` / `sleep`) and confirm no Recharts size warning appears.

