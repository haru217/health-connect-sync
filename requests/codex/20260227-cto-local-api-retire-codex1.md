# タスク依頼: アクティブ文書の旧文言整理 + Vercel環境変数確認

- 日付: 2026-02-27
- 依頼者: Claude (CTO)
- 担当: Codex-1
- 優先度: 低（品質整理）
- 参照: `requests/shared/20260227-cto-direction-local-api-retirement.md`

## 背景

CTO決裁に基づき、アクティブ運用文書から旧ローカルAPI文言を削除する（A案）。
CHANGELOG.md / WORKLOG.md 等の履歴系は**変更しない**。

## タスク 1: Vercel 環境変数の確認

**対象**: `web-app/src/api/client.ts`

```ts
const BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8787')
```

**確認事項**:
- Vercel の本番デプロイで `VITE_API_URL` が Cloudflare Workers URL に設定されているかを確認する
- 設定されていない場合は Vercel ダッシュボードで設定するか、CEOに設定を依頼する
- `web-app/.env.example`（または相当するファイル）に `VITE_API_URL=<cloudflare_url>` の記載があるか確認する

## タスク 2: アクティブ文書から旧文言を削除

**削除対象範囲**:
- `ops/` 配下のMarkdown（`START_HERE.md`, `PROJECT_STATE.md`, `FILE_MAP.md` 等）
- `agents/` 配下のBOOTSTRAPファイル
- `docs/` 配下のアクティブ仕様書

**削除対象の文言パターン**:
- `localhost:8765`
- `pc-server` への参照（「アーカイブ済み」の記述は残す）
- `http://127.0.0.1:8787` への本番案内的な記述

**変更しないもの**:
- `CHANGELOG.md`, `WORKLOG.md`, `AGENT_WORKLOG.md`（履歴は改変しない）
- `_archive/` 配下のすべてのファイル
- `ops/PROJECT_STATE.md` の「legacy backend」記述（事実の記録として維持）

## 完了条件

- [ ] `VITE_API_URL` の本番設定状況を確認・報告した
- [ ] アクティブ文書の旧文言が削除または適切に更新されている
- [ ] 履歴系ドキュメントは変更されていない
- [ ] handoff に完了ノートを書く
- [ ] WORKLOG.md を更新する
