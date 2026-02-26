# タスク依頼: WebアプリをCloudflare APIに接続してローカル確認を完了する

- 依頼日: 2026-02-26
- 依頼者: Claude (CTO)
- 担当: Codex-1（フロントエンド）
- 優先度: **最優先**（CEO指示）
- ダッシュボードID: P1-1-5

## 背景・目的

CEOの指示により「ローカルのUIにCloudflareのデータを入れる」ことが最優先タスクとなった。

現状の確認結果：
- `web-app/.env.local` は `VITE_API_URL=http://127.0.0.1:8787` に設定済み（wrangler dev）
- `cloudflare-api/src/index.ts` に全エンドポイントが実装済み
- ただし、web-app（ローカル dev）と cloudflare-api（wrangler dev）が
  **実際に端から端まで動作するか**の確認が取れていない

## 作業内容

### ステップ1: 動作確認
1. `wrangler dev` で cloudflare-api を起動（port 8787）
2. `npm run dev` で web-app を起動（`web-app/.env.local` の設定を使用）
3. 全主要画面（ホーム・コンディション・運動・食事・プロフィール）で
   データが表示されること、エラーが出ないことを確認する

### ステップ2: 型・レスポンス整合性の確認
web-app が呼び出す各エンドポイントと cloudflare-api のレスポンスが
`web-app/src/api/types.ts` の型定義に合致しているか確認する。

確認対象エンドポイント：
- `GET /api/home-summary`
- `GET /api/summary`
- `GET /api/connection-status`
- `GET /api/body-data`
- `GET /api/sleep-data`
- `GET /api/vitals-data`
- `GET /api/nutrition/day`
- `GET /api/supplements`
- `GET /api/profile`

### ステップ3: 不一致の修正
型不一致・フィールド欠落・エラーが見つかった場合は修正する。
修正範囲は以下のいずれか：
- `cloudflare-api/src/index.ts` のレスポンス形式を調整する
- `web-app/src/api/types.ts` の型定義を実態に合わせる
- `web-app/src/api/healthApi.ts` のフォールバック処理を改善する

### ステップ4: D1ローカルデータ確認
wrangler dev で D1 にデータがなくて画面が空の場合、
`POST /api/dev/seed-mock` でモックデータを投入して表示確認する。

## 完了条件

- [ ] wrangler dev + web-app dev の組み合わせで全主要画面が表示できる
- [ ] ブラウザコンソールにAPI関連のエラーが出ない
- [ ] `/api/home-summary` のレスポンスが HomeScreen に正しく反映されている

## 参照ファイル

- `web-app/src/api/client.ts` — BASE_URL設定
- `web-app/src/api/types.ts` — 型定義
- `web-app/src/api/healthApi.ts` — API呼び出し一覧
- `cloudflare-api/src/index.ts` — エンドポイント実装
- `web-app/.env.local` — ローカル接続先設定

## 注意事項

- `web-app/.env.local` は `.gitignore` 対象外なので編集しても commit に注意
- `VITE_API_KEY` は `web-app/.env.local` の `test12345` を使用（wrangler devのテストキー）
- pc-server（port 8765）は今後 legacy 扱いのため、このタスクでは一切使わないこと
