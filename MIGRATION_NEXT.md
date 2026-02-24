# GCP 軽量化 残タスク引継ぎ

## 現状
- GCP VM: `user@34.171.85.174` (SSH key: `~/.ssh/id_rsa_gcp`)
- Named Tunnel 設定済み: ID=`74e58b6d-2c33-499f-ba0e-ea9446ac099d`
- 問題: ingress に `health-ai.kokomaru3.com` が設定されている（ドメイン未所持のため404になる）

## Task 1: ingress 修正（最優先・API実行可）

```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/b0525062f69fb465d854b75b469d25f5/cfd_tunnel/74e58b6d-2c33-499f-ba0e-ea9446ac099d/configurations" \
  -H "X-Auth-Email: kokomaru3@gmail.com" \
  -H "X-Auth-Key: 71c0a37fd0dc14b49b25eb86d7bce46a05928" \
  -H "Content-Type: application/json" \
  -d '{"config":{"ingress":[{"service":"http://api:8080"},{"service":"http_status:404"}]}}'
```

成功後、動作確認:
```bash
curl -s https://74e58b6d-2c33-499f-ba0e-ea9446ac099d.cfargotunnel.com/healthz
# → {"ok": true} が返れば成功
```

## Task 2: Vercel 環境変数更新【手動・ユーザー作業】

Vercel ダッシュボード → health-connect-sync プロジェクト → Settings → Environment Variables:
- `VITE_API_URL` = `https://74e58b6d-2c33-499f-ba0e-ea9446ac099d.cfargotunnel.com`
- Redeploy を実行

現在の値は `https://user-purple-hill-1159.fly.dev`（古いFly.io URL）

## Task 3: Android アプリの接続先更新【手動】
新しいトンネルURLと API_KEY（現在 `test12345`）に更新する

## 完了済み作業メモ
- exim4 削除済み（16MB解放）
- docker-compose: caddy削除、mem_limit 400m、healthcheck追加
- summary.py: SQLite永続キャッシュ実装済み
- Swap: 1GB→2GB拡張済み
- Cloudflare MCP: `~/.claude.json` に `run b0525062f69fb465d854b75b469d25f5` args追加済み（wrangler login済み）
- GCP VM SSH: `ssh -i ~/.ssh/id_rsa_gcp user@34.171.85.174`
