# ローカル版 クイックスタート

1) PCでサーバ起動（ワンコマンド）
```powershell
cd projects/health-connect-sync/pc-server

# .env を作って API_KEY を入れておくと楽（.env.example参照）
.\run.ps1
```

2) Androidアプリに設定
- `Discover PC`（自動発見）
- API key を入力 → `Save`
- `Test` でPCに届くか確認

3) Health Connect
- `Grant Health Connect permissions`
- `Check Health Connect` で AVAILABLE / allGranted=true を確認

4) 同期
- `Sync now`
- PCの `http://localhost:8765/ui` を開いて反映を確認

困ったら：`../TROUBLESHOOT.md`

OpenAPI: `openapi-local.yaml`

補足
- Android→PCはHTTP（ローカル）なので、Android側は `usesCleartextTraffic=true` を有効化済み
