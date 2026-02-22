# Codex Decision Memo - STEP7 Icon Strategy

Updated: 2026-02-22
Owner decision: confirmed by user

## Final Decision
- STEP7 PNG replacement is cancelled.
- Navigation and UI icons will continue using SVG.
- We do not proceed with PNG-based icon migration.

## Why
- Generated PNG quality did not meet product standards.
- Current SVG-based UI is already working and maintainable.

## Execution Policy (Effective Immediately)
1. Keep `web-app/src/App.tsx` navigation icons in SVG.
2. Do not add new PNG nav icon assets under `web-app/public/assets/icons/` for STEP7.
3. Do not apply CSS color-filter hacks for PNG active states.
4. Any icon refinements should be done by improving SVG design or replacing with higher-quality SVG.

## Scope Impact
- STEP6 outputs remain valid.
- Existing advisor images can stay as-is where already used.
- This file supersedes the previous PNG integration instructions.

## Completion Definition
- Repository documentation reflects: "STEP7 PNG = cancelled, SVG = adopted".
- No pending work item should require PNG icon migration.
