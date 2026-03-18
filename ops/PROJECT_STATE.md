# Project State (Canonical)

Last updated: 2026-03-18

## Current direction
- **Android ネイティブアプリ（Jetpack Compose）をメインプロダクトに移行中**
- Backend: `cloudflare-api/` (Cloudflare Workers + D1)
- Android app: `android-sync/` (同期+UIを統合したネイティブアプリに拡張中)
- Web app: `web-app/` (レガシー — ネイティブ移行後に段階縮退)
- Archived: `_archive/`

## Agent setup (3エージェント体制)
- CEO: 優先順位・プロダクト判断
- Claude (CTO): 要件定義・仕様書・タスク分解・全体指揮
- Codex: Android・バックエンド実装。**MCP経由で直接指示**
- Gemini: UIデザイン・ストア素材。**CLI経由で直接呼び出し**

## Immediate objective
- **Android v1.0 リリース（目標: 2026-04-14）**
- 詳細: `docs/v3/android-v1-release-plan.md`

## Key decisions (2026-03-18 CEO承認済み)
- 4タブ構成: ホーム・食事・データ・マイページ
- AI: 「はる」1人に統一（旧3専門家廃止）
- 課金: 回数制限型フリーミアム、価格未確定
- ターゲット: スマートデバイス装着層
- 技術: Jetpack Compose, Firebase Auth, RevenueCat
