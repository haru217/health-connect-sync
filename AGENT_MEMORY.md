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

## Restart prompt (copy in new session)
`C:\\Users\\user\\health-connect-sync\\AGENT_MEMORY.md` を読んで、睡眠時間ズレ修正の続きから実装して。
