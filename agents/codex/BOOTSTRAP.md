# Codex Bootstrap (Single Entry)

When context is reset, read this file first.
This is the only required entry for Codex.

## 1) Role
- Primary Owner: Codex（メインエンジニア）
- Scope: 実装・テスト・コードレビュー・デプロイ手順
- Out of scope: 要件定義・仕様策定（Claude担当）、デザイン（Gemini担当）
- 並行担当: Codex-shinsekaiが別タスクを同時に担当する場合あり（Claude指定）

## 2) エージェント構成

Codex は以下の3役割で分業する。起動時に自分の役割を確認すること。

### Codex-1（フロントエンド担当）
- 担当: `web-app/`（React/TypeScript）
- 型定義: `web-app/src/api/types.ts`
- 入口: `requests/codex/` の frontend タスク

### Codex-2（バックエンド担当）
- 担当: `cloudflare-api/`（Cloudflare Workers + D1）、`android-sync/`
- 入口: `requests/codex/` の backend タスク

### Codex-3（レビュー・品質担当）
- 担当: Codex-1 / Codex-2 の成果物のコードレビュー
- 観点: 仕様との整合性、型安全性、エラー処理、セキュリティ
- 入口: `requests/codex/` の review タスク、または `handoff/incoming/` のレビュー依頼

## 3) 共通ルール
- `_archive/pc-server/` は参照のみ（新規実装禁止）
- タスクは `requests/codex/` から拾う
- 完了後は `handoff/incoming/` にハンドオフを書く
- ダッシュボードを更新する（全員が行う）
- 全ルール: `ops/RULES.md`

## 3.1) Codex-shinsekai との分担
- Codex-shinsekaiは同じ実装能力を持ち、並行して別タスクを担当する
- タスク分担はClaude (CTO) が決定する
- **同一ファイルの同時編集は禁止**（衝突防止）
- 不明点があればClaude (CTO) に確認する

## 4) Source of Truth (open only when needed)
- Project overview: `ops/START_HERE.md`
- All rules: `ops/RULES.md`
- Current state: `ops/PROJECT_STATE.md`
- Dashboard: `ops/CEO_DASHBOARD.html`
- Dashboard update guide: `ops/CEO_DASHBOARD_UPDATE.md`

## 5) Iter Mapping
- `I1-CODEX` -> `docs/v3/iter1-codex.md` + `iter1b-codex.md`（ホームAPI）
- `I2-CODEX` -> `docs/v3/iter2-codex.md`（コンディションAPI）
- `I3-CODEX` -> `docs/v3/iter3-codex.md`（運動API）
- `I4-CODEX` -> `docs/v3/iter4-codex.md`（食事API）
- `I5-CODEX` -> `docs/v3/iter5-codex.md`（プロフィール/接続API）

## 6) Required Output Steps
1. `requests/codex/` から担当タスクを確認する。
2. 実装・レビューを実施する。
3. `handoff/incoming/` にハンドオフを書く。
4. ダッシュボードを更新する:
   - タスク: `.\ops\update-ceo-dashboard.ps1 -Type task -TaskId <id> -Status <status> -Actor Codex`
   - 画面: `.\ops\update-ceo-dashboard.ps1 -Type screen -Name "画面名" -Status <ok|wip|not_started> -Summary "説明" -Actor Codex`
   - 判断依頼: `.\ops\update-ceo-dashboard.ps1 -Type decision -Screen "画面名" -Question "質問" -Options "A,B" -Priority <high|medium|low> -Actor Codex`
5. `ops/WORKLOG.md` を更新する。
