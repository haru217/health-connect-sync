# Health Connect Sync Bridge API (FastAPI)

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export TOKEN_PEPPER='dev-pepper'
export REGISTER_ENABLED='true'

uvicorn app.main:app --reload --port 8080
```

## Cloud Run (outline)
- Build and deploy the container to Cloud Run (region `asia-northeast1`).
- Ensure Firestore is enabled (Native mode) in the same region.
- Set env vars:
  - `TOKEN_PEPPER` (required)
  - `REGISTER_ENABLED` (true initially, then false after the device is registered)
  - `REGISTER_KEY` (optional; if set, `/v1/register` requires `X-Register-Key` header)

## Endpoints
- `GET /health`
- `POST /v1/register`
- `POST /v1/sync` (Bearer auth)
