# Request: Condition backend null-fill for Health tab

- Date: 2026-02-26
- Owner: Codex
- Status: `done`

## Background
- Condition tab has many blank values.
- Policy: if Health Connect source is missing, fill with computed values when possible.
- Source note: `C:\Users\senta\.gemini\antigravity\brain\333a8c02-8344-4f5e-bf50-17a81168eec0\unused_health_data.md.resolved`

## Scope
- Backend (`cloudflare-api/src/index.ts`) and minimal consumer wiring in `web-app/src/screens/HealthScreen.tsx`.
- Improve `/api/body-data`, `/api/sleep-data`, `/api/vitals-data` so fields are populated when derivable, and ensure Health tab renders those fields.

## Acceptance Criteria
1. `/api/sleep-data` returns non-null stage values when source records exist.
2. `/api/sleep-data` returns bedtime/wake_time when derivable from sleep records.
3. `/api/body-data` provides BMR fallback by calculation when measured value is missing and inputs exist.
4. `/api/vitals-data` uses heart-rate fallback for resting HR when possible.
5. Condition data endpoints trigger aggregate refresh before response.

## Result
- Completed in `cloudflare-api/src/index.ts`, `web-app/src/screens/HealthScreen.tsx`, and `web-app/src/api/types.ts`.
