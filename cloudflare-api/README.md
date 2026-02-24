# Cloudflare API (D1)

This Worker provides the API used by `web-app` and stores data in Cloudflare D1.

## Endpoints

- `GET /healthz`
- `GET /api/summary`
- `POST /api/sync`
- `GET /api/nutrition/day?date=YYYY-MM-DD`
- `POST /api/nutrition/log`
- `DELETE /api/nutrition/log/:id`
- `GET /api/supplements`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/nutrients/targets?date=YYYY-MM-DD`
- `GET /api/prompt?type=daily|weekly|monthly`
- `GET /api/reports?report_type=daily|weekly|monthly`
- `POST /api/reports`
- `GET /api/reports/:id`
- `DELETE /api/reports/:id`
- `POST /api/dev/seed-mock`

## Setup

```bash
cd cloudflare-api
npm install
```

## Create D1

```bash
npx wrangler d1 create health_connect_sync
```

Copy `database_id` into `wrangler.toml` (`database_id = "..."`).

## Apply migration

```bash
npx wrangler d1 migrations apply health_connect_sync --remote
```

## Set secrets

```bash
echo test12345 | npx wrangler secret put API_KEY
```

Optional seed token:

```bash
echo your-seed-token | npx wrangler secret put MOCK_SEED_TOKEN
```

## Deploy

```bash
npm run deploy
```

## Seed mock data

```bash
curl -X POST "https://<worker>.workers.dev/api/dev/seed-mock" \
  -H "X-Api-Key: test12345"
```

## Android manual sync

- Keep periodic sync OFF.
- Set Android sync URL to:
  - `https://health-connect-sync-api.kokomaru3-healthsync.workers.dev`
- Keep API key:
  - `test12345`
