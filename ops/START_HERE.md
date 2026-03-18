# START HERE (Single Entry Point)

Last updated: 2026-03-18

## 1) What this project is
- Product: **Health OS** — 複数の健康データを横断統合し、AIアシスタント「はる」が健康アドバイスを提供するAndroidネイティブアプリ
- Core flow: Android Health Connect → Jetpack Compose App → Cloudflare Workers/D1 → LLM → AIレポート
- 設計ドキュメント: `docs/v3/android-v1-release-plan.md`

## 2) Current production line (source of truth)
- Android app: `android-sync/` (Jetpack Compose — 同期+UI統合アプリに移行中)
- API: `cloudflare-api/` (Cloudflare Workers + D1)
- Web app: `web-app/` (React + Vercel — レガシー。ネイティブアプリ移行後は段階的に縮退)
- Archived legacy: `_archive/`

## 3) Agent role split (3エージェント体制)
- **CEO**: プロダクト判断・優先順位決定
- **Claude** (CTO / 司令塔): 要件定義・仕様策定・タスク分解・全体指揮・CEO壁打ち
- **Codex** (エンジニア): Android・バックエンド実装・コードレビュー。ClaudeからMCP経由で直接指示
- **Gemini** (デザイナー): UI/UXデザイン・ストア素材・デザイン相談。ClaudeからCLI経由で直接呼び出し

## 4) Mandatory process
1. CTO（Claude）がCEOと要件を詰め、仕様書を `docs/v3/` に作成する
2. Codex/Geminiに直接指示を出して実装・デザインを進める
3. **CEO承認後に**実装を開始する（UI/UX変更は事前承認必須）
4. 動作確認後に git commit する（タスク1件 = 1コミット以上）
5. ダッシュボードを更新する（`ops/RULES.md` §3 参照）

## 5) Quick links
- Rules (全ルール集約): `ops/RULES.md`
- Android v1.0リリースプラン: `docs/v3/android-v1-release-plan.md`
- CEO dashboard: `ops/archive/CEO_DASHBOARD.html`
- Tech debt tracker: `ops/TECH_DEBT.md`
