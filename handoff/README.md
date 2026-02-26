# Handoff Directory

Purpose:
- Structured delivery between agents and CEO.

Folders:
- `incoming/`: newly posted handoffs awaiting review/acceptance
- `done/`: accepted handoffs

File naming:
- `YYYYMMDD-<agent>-<topic>.md`
- Example: `20260226-codex-api-connection-status.md`

How to write a handoff:
1. Copy `ops/templates/handoff.md`
2. Include changed files and verification commands
3. State blockers or residual risk explicitly
4. Save to `incoming/`

Close workflow:
1. Reviewer confirms output
2. Move handoff file from `incoming/` to `done/`
3. Mark original request as `done`
