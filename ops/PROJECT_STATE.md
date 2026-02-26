# Project State (Canonical)

Last updated: 2026-02-26

## Infra direction
- Primary backend path: `cloudflare-api/`
- Android sync target: Cloudflare Workers URL (`android-sync/.../AppConfig.kt`)
- `pc-server/` remains as legacy/local utility path, not primary production API

## Role split
- CEO: 優先順位・プロダクト判断
- Claude (CTO): 要件定義・仕様書・タスク分解・技術方針。CEOと壁打ちして仕様を策定する
- Codex (実装・レビュー): マルチエージェント構成。Codex-1=フロントエンド、Codex-2=バックエンド、Codex-3=レビュー
- Gemini (デザイン): UIデザイン・クリエイティブ・ストア素材

## Active integration gaps (current)
- `MyScreen` still placeholder in `web-app`
- Worker endpoint `/api/connection-status` exists but frontend integration pending
- Some in-progress changes exist simultaneously in `cloudflare-api` and `pc-server`

## Immediate objective
- Keep all new planning and handoff in the new `ops/ + requests/ + handoff/` structure.
