# OpenClaw Ingest Schema

OpenClaw から `health-connect-sync` に食事データを渡すための共通スキーマ。

## Endpoint

- `POST /api/openclaw/ingest`
- Header: `X-Api-Key: <API_KEY>`

## Request Body

```json
{
  "event_id": "openclaw:2026-02-18:discord:msg123:item0",
  "source": "openclaw",
  "local_date": "2026-02-18",
  "intake_kcal": 1800,
  "intake_note": "OpenClaw daily intake",
  "items": [
    {"alias": "protein", "count": 1, "note": "post workout"},
    {"label": "rice bowl", "count": 1, "kcal": 550, "protein_g": 16, "fat_g": 14, "carbs_g": 88}
  ]
}
```

## Field Rules

- `event_id`:
  - Required string.
  - Must be stable for retries (same event is always same id).
  - Duplicate `event_id` is accepted but ignored (idempotent).
- `source`:
  - Optional string, default `openclaw`.
- `local_date`:
  - Optional `YYYY-MM-DD`.
  - If each item has no `local_date`/`consumed_at`, this value is copied to each item.
- `intake_kcal`:
  - Optional number.
  - If present, upserts `intake_calories_daily` for `local_date`.
- `items`:
  - Required non-empty array.
  - Item must be either alias style (`alias`) or custom style (`label` + macros).

## Item Schema

Common item fields:
- `alias` or `label` (one of them required)
- `count` (optional, default `1`)
- `note` (optional)
- `local_date` (optional `YYYY-MM-DD`)
- `consumed_at` (optional ISO datetime)

Custom nutrition item fields (when `label` is used):
- `kcal`
- `protein_g`
- `fat_g`
- `carbs_g`
- `micros` (optional object)

Micronutrient policy for `label` items:
- If `micros` is missing (or partially missing), server-side estimation fills gaps.
- If `micros` has a key, that value overrides the estimated value for that key.
- Goal is to avoid false "not consumed" diagnostics caused by missing data.

## Legacy Compatibility

Legacy pending format is still accepted by importer:

```json
{
  "local_date": "2026-02-18",
  "items": [ ... ]
}
```

If `event_id` is missing in legacy lines, importer synthesizes a stable id:

- `legacy:<filename>:<line_no>:<sha1>`

## Response

### New ingest
```json
{"ok": true, "ingested": 1, "duplicate": 0, "eventId": "openclaw:..."}
```

### Duplicate ingest
```json
{"ok": true, "ingested": 0, "duplicate": 1, "eventId": "openclaw:..."}
```

### Validation error
```json
{"detail": "Invalid payload: ..."}
```
