# OpenClaw Handoff Runbook

This runbook explains how OpenClaw should hand off nutrition records to this PC service.

## 1) Preferred path: direct HTTP

- Endpoint: `POST /api/openclaw/ingest`
- Header: `X-Api-Key: <API_KEY>`
- Body: see `docs/openclaw-ingest-schema.md`

### Important

- Use a stable `event_id` for each OpenClaw event.
- Retry with the same `event_id`.
- Duplicate retry is safe (`duplicate=1`, no double count).

## 2) Fallback path: pending file

When direct HTTP is unavailable:

1. Write JSONL into `pending/inbox/*.jsonl`
2. One JSON object per line
3. Prefer atomic write (write temp file then rename)
4. Run importer:
   - Manual: `pc-server/import-pending.ps1`
   - Auto watch: `pc-server/run.ps1 -WatchPending`

Importer behavior:

- Success file -> `pending/archive/YYYY-MM-DD/`
- Error file -> `pending/error/` + `.err` reason file

## 3) Daily intake from OpenClaw

If OpenClaw determines daily intake calories, include:

- `local_date`
- `intake_kcal`
- optional `intake_note`

This upserts `intake_calories_daily` and is reflected in dashboard / reports.

## 4) Quick validation

```powershell
curl -X POST "http://localhost:8765/api/openclaw/ingest" `
  -H "Content-Type: application/json" `
  -H "X-Api-Key: <API_KEY>" `
  -d "{\"event_id\":\"openclaw:test:1\",\"local_date\":\"2026-02-18\",\"items\":[{\"alias\":\"protein\",\"count\":1}]}"
```

Expected:

```json
{"ok":true,"ingested":1,"duplicate":0,"eventId":"openclaw:test:1"}
```

Same request again:

```json
{"ok":true,"ingested":0,"duplicate":1,"eventId":"openclaw:test:1"}
```
