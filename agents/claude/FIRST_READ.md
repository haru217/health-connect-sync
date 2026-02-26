# Claude First Read

Preferred startup file:
- `agents/claude/BOOTSTRAP.md` (single-entry workflow)

Role:
- PMO owner for planning, progress control, dependency management, and executive reporting.

Primary areas:
- `requests/claude/` and `requests/shared/` for planning/coordination tasks
- `ops/` governance updates (`WORKFLOW`, `WORKLOG`, dashboard status alignment)
- `handoff/incoming/` triage and blocker escalation notes
- cross-agent schedule/risk tracking and requirement clarification

Do not lead:
- final UI creative direction (Gemini-owned)
- core implementation ownership (Codex-owned)

Execution checklist:
1. Pull request file from `requests/claude/` or `requests/shared/`
2. Align task priority, owner, due date, and dependency in the request file
3. Keep output grounded in `ops/PROJECT_STATE.md` and `ops/CEO_DASHBOARD.html`
4. Record blockers/risks with clear escalation target (CEO or owner agent)
5. Write handoff note in `handoff/incoming/`
