# Requests Directory

Purpose:
- Single intake queue for all agent work.

Folders:
- `codex/`: implementation and technical execution requests
- `gemini/`: UI/creative direction requests
- `claude/`: PMO requests (planning, progress control, risk/dependency management, reporting)
- `shared/`: cross-agent requests requiring collaboration

File naming:
- `YYYYMMDD-<topic>.md`
- Example: `20260226-connection-status-ui.md`

How to create a request:
1. Copy `ops/templates/task-request.md`
2. Fill all metadata and acceptance criteria
3. Place it in the target agent folder
4. Set status to `todo`

Rules:
- One request file per deliverable.
- Keep acceptance criteria concrete and testable.
- Update status as work progresses (`todo` -> `in_progress` -> `blocked|done`).
