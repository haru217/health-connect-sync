# Nutrition API

## Auth

All endpoints below require:

- Header: `X-Api-Key: <API_KEY>`

---

## 1. `POST /api/nutrition/log`

Manual nutrition/supplement logging.

### Alias example

```json
{"alias":"protein","count":1}
```

### Custom item example

```json
{
  "label":"rice bowl",
  "count":1,
  "kcal":550,
  "protein_g":16,
  "fat_g":14,
  "carbs_g":88,
  "micros":{"salt_equivalent_g_max":1.8}
}
```

Behavior for `label` items:
- The server auto-estimates micronutrients to reduce missing coverage.
- If `micros` is provided, provided values override estimated values per key.
- This applies to both `POST /api/nutrition/log` and `POST /api/openclaw/ingest`.

### Batch example

```json
{
  "items":[
    {"alias":"protein","count":1},
    {"alias":"vitamin_d","count":1},
    {"alias":"multivitamin","count":1}
  ]
}
```

### Backfill example

```json
{"alias":"protein","count":1,"local_date":"2026-02-18"}
```

---

## 2. `POST /api/openclaw/ingest`

OpenClaw handoff endpoint (idempotent by `event_id`).

### Example

```json
{
  "event_id":"openclaw:2026-02-18:discord:msg123:item0",
  "source":"openclaw",
  "local_date":"2026-02-18",
  "intake_kcal":1800,
  "items":[
    {"alias":"protein","count":1},
    {"label":"rice bowl","count":1,"kcal":550,"protein_g":16,"fat_g":14,"carbs_g":88}
  ]
}
```

### Success (new)

```json
{"ok":true,"ingested":1,"duplicate":0,"eventId":"openclaw:2026-02-18:discord:msg123:item0"}
```

### Success (duplicate)

```json
{"ok":true,"ingested":0,"duplicate":1,"eventId":"openclaw:2026-02-18:discord:msg123:item0"}
```

### Validation error

```json
{"detail":"Invalid payload: ..."}
```

See: `docs/openclaw-ingest-schema.md`

---

## 3. `GET /api/nutrition/day?date=YYYY-MM-DD`

Returns nutrition events and totals for one local date.

---

## 4. `GET /api/report/yesterday`

Returns yesterday summary text.

```json
{"text":"..."}
```
