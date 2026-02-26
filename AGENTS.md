# Agent Operating Rules (health-connect-sync)

This file is the mandatory bootstrap for all agents working in this repository.

## Read Order (required)
1. `ops/START_HERE.md`
2. `agents/common/FIRST_READ.md`
3. Your role file:
   - Claude (CTO): `agents/claude/BOOTSTRAP.md`
   - Codex (実装・レビュー、マルチエージェント): `agents/codex/BOOTSTRAP.md`
   - Gemini (デザイン・クリエイティブ): `agents/gemini/BOOTSTRAP.md`

## Where To Put Things
- New task requests: `requests/<agent>/`
- Cross-agent requests: `requests/shared/`
- Handoffs: `handoff/incoming/`
- Completed handoffs: `handoff/done/`
- Project governance docs: `ops/`

## Non-negotiables
- Do not create new top-level files unless explicitly requested.
- Do not use legacy docs as the primary planning surface.
- Keep implementation scope aligned with your role split.
- Always leave a handoff note when your task is done or blocked.
- When task status changes (`done`/`blocked`) or phase changes, update `ops/CEO_DASHBOARD.html`.
- In `ops/CEO_DASHBOARD.html`, update the leaf task status and ensure a completion stamp is recorded.
- Preferred command: `ops/update-ceo-dashboard-task.ps1 -TaskId <id> -Status <todo|in_progress|blocked|done> -Actor <name>`.

## Encoding Safety (Japanese text)
- All text files must stay `UTF-8` (see `.editorconfig`).
- Never rewrite a whole Japanese text file via shell redirection or `WriteAllText`; use minimal `apply_patch` edits.
- Never use `Set-Content`/`Out-File` without explicit UTF-8 encoding.
- If an edit target appears mojibake, stop and recover from a valid source before continuing edits.
