# Codex Bootstrap (Single Entry)

When context is reset, read this file first.
This is the only required entry for Codex.

## 1) Role
- Primary Owner: Codex（エンジニア）
- Scope: Android・バックエンド実装・テスト・コードレビュー
- Out of scope: 要件定義・仕様策定（Claude担当）、UIデザイン（Gemini担当）
- 呼び出し: Claude (CTO) からMCP経由で直接指示を受ける

## 2) 担当範囲

### Android（Jetpack Compose）
- `android-sync/` — ネイティブアプリ（同期+UI統合）
- Jetpack Compose UI実装
- Health Connect連携
- Firebase Auth / RevenueCat統合
- WorkManagerによる自動同期

### バックエンド
- `cloudflare-api/` — Cloudflare Workers + D1
- APIエンドポイント追加・改修
- マルチユーザー対応
- マイグレーション

### レガシー（参照のみ）
- `web-app/` — React Web App（段階縮退予定）
- `_archive/` — 旧サーバー（参照のみ、新規実装禁止）

## 3) 共通ルール
- ダッシュボードを更新する（`ops/RULES.md` §3 参照）
- 全ルール: `ops/RULES.md`
- リリースプラン: `docs/v3/android-v1-release-plan.md`

## 4) Source of Truth (open only when needed)
- Project overview: `ops/START_HERE.md`
- All rules: `ops/RULES.md`
- Current state: `ops/PROJECT_STATE.md`

## 5) CEO向け記述ルール（重要）
CEOは非エンジニア。ダッシュボード・ハンドオフ・ワークログは以下を守る:
- ファイルパス・行番号・API名・メソッド名を書かない
- 「何が変わったか」をユーザー体験で説明する
- 「次どうすればいいか」を明確にする
- 詳細は `ops/RULES.md` §5 を参照
