# START HERE (Single Entry Point)

Last updated: 2026-02-26

## 1) What this project is
- Product: Health AI Advisor
- Core flow: Android Health Connect sync -> API aggregation -> Web UI + reports

## 2) Current production line (source of truth)
- Frontend: `web-app/`
- API: `cloudflare-api/` (Cloudflare Workers + D1)
- Android sync app: `android-sync/`
- Legacy backend (reference only): `pc-server/`

## 3) Agent role split
- CEO: プロダクト判断・優先順位決定
- Claude (CTO): 要件定義・仕様書作成・タスク分解。CEOと壁打ちして仕様を策定する
- Codex (実装・レビュー、マルチエージェント):
  - Codex-1: フロントエンド（`web-app/`）
  - Codex-2: バックエンド（`cloudflare-api/`, `android-sync/`）
  - Codex-3: コードレビュー・品質確認
- Gemini (デザイン): UIデザイン・クリエイティブ・ストア素材

## 4) Mandatory process
1. CTO（Claude）がCEOと要件を詰め、仕様書とタスクを `requests/<agent>/` に作成する
2. 各エージェントがスコープ内の作業を実施する
3. 動作確認後に git commit する（タスク1件 = 1コミット以上）
4. `handoff/incoming/` にハンドオフを書く
5. ダッシュボードを更新する
6. `ops/WORKLOG.md` を更新する

## 5) Quick links
- File map: `ops/FILE_MAP.md`
- Workflow: `ops/WORKFLOW.md`
- Common rules: `agents/common/FIRST_READ.md`
- CEO dashboard: `ops/CEO_DASHBOARD.html`
- Dashboard update guide: `ops/CEO_DASHBOARD_UPDATE.md`
