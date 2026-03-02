# Agent Operating Rules (health-connect-sync)

This file is the mandatory bootstrap for all agents working in this repository.

## Read Order (required)
1. `ops/START_HERE.md`
2. Your role file:
   - Claude (CTO): `agents/claude/BOOTSTRAP.md`
   - Claude-shinsekai (CTO補助): `agents/claude-shinsekai/BOOTSTRAP.md`
   - Codex (メインエンジニア): `agents/codex/BOOTSTRAP.md`
   - Codex-shinsekai (サブエンジニア): `agents/codex-shinsekai/BOOTSTRAP.md`
   - Gemini (デザイナー): `agents/gemini/BOOTSTRAP.md`
3. `ops/RULES.md` — 全エージェント共通ルール

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
- When task status changes, update `ops/archive/CEO_DASHBOARD.html`.
- Dashboard update command:
  ```powershell
  .\ops\update-ceo-dashboard.ps1 -Type <task|screen|decision|approval> ...
  ```
  See `ops/RULES.md` §3 for full usage.

## CEO記述ルール（全エージェント必読）
CEOは非エンジニア。ダッシュボード・ハンドオフ・ワークログに技術用語を書かない。
詳細は `ops/RULES.md` §5 を参照。

## 承認ゲート
実装着手前にCEO承認を取る（計画→ダッシュボードに承認待ち登録→CEO承認→実装開始）。
詳細は `ops/RULES.md` §4 を参照。

## Encoding Safety (Japanese text)
- All text files must stay `UTF-8` (see `.editorconfig`).
- Never rewrite a whole Japanese text file via shell redirection or `WriteAllText`; use minimal edits.
- Never use `Set-Content`/`Out-File` without explicit UTF-8 encoding.
- If an edit target appears mojibake, stop and recover from a valid source before continuing edits.
