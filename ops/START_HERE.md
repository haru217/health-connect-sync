# START HERE (Single Entry Point)

Last updated: 2026-03-02

## 1) What this project is
- Product: **Health OS** — 複数の健康データを横断統合し、今日の最適行動を提案する健康AI
- Core flow: Android Health Connect → Sync APK → Cloudflare Workers/D1 → ルールエンジン → LLM → React Web App
- 設計ドキュメント: `docs/plans/2026-03-02-health-os-design.md`

## 2) Current production line (source of truth)
- Frontend: `web-app/` (React + Vercel)
- API: `cloudflare-api/` (Cloudflare Workers + D1)
- Android sync app: `android-sync/`
- Archived legacy: `_archive/`

## 3) Agent role split (5エージェント体制)
- **CEO**: プロダクト判断・優先順位決定
- **Claude** (CTO / 司令塔): 要件定義・仕様策定・タスク分解・全体指揮・CEO壁打ち
- **Claude-shinsekai** (CTO補助): 調査・情報収集・ドキュメント下書き（Claudeの指示で動く）
- **Codex** (メインエンジニア): フロント・バックエンド実装・コードレビュー
- **Codex-shinsekai** (サブエンジニア): Codexと並行して別タスクを担当（Claudeが分担を指定）
- **Gemini** (デザイナー兼フロントエンド): UI/UXデザイン・フロントエンド実装（React/CSS/SVGチャート）・アイコン・ストア素材。UI/UX変更時はCEO承認必須

## 4) Mandatory process
1. CTO（Claude）がCEOと要件を詰め、仕様書とタスクを `requests/<agent>/` に作成する
2. 担当エージェントが実装計画を立て、ダッシュボードに「承認待ち」を登録する
3. **CEO承認後に**実装を開始する
4. 動作確認後に git commit する（タスク1件 = 1コミット以上）
5. `handoff/incoming/` にハンドオフを書く
6. ダッシュボードを更新する（`ops/RULES.md` §3 参照）

## 5) Quick links
- Rules (全ルール集約): `ops/RULES.md`
- Workflow: `ops/WORKFLOW.md`
- File map: `ops/FILE_MAP.md`
- CEO dashboard: `ops/archive/CEO_DASHBOARD.html`
- Dashboard update guide: `ops/CEO_DASHBOARD_UPDATE.md`
- Health OS設計: `docs/plans/2026-03-02-health-os-design.md`
