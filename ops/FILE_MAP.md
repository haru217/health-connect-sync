# File Map (Operational)

## Operational control (new)
- `ops/`:
  - governance, process, status, templates
- `agents/`:
  - per-agent startup instructions
- `requests/`:
  - task requests by owner agent
- `handoff/`:
  - execution results and blockers

## Product implementation (existing)
- `web-app/`: React frontend
- `cloudflare-api/`: Worker + D1 backend
- `android-sync/`: Android sync client
- `pc-server/`: legacy backend path (non-primary)

## Legacy docs (do not use as first source unless needed)
- `TASK.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `AGENT_MEMORY.md`, `AGENT_WORKLOG.md`

