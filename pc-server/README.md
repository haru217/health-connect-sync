# PCローカルサーバ（FastAPI + SQLite）

## 1) インストール
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) 起動（ワンコマンド）
### PowerShell（推奨）
```powershell
cd projects/health-connect-sync/pc-server

# 初回: venv作成・依存インストールも含めて起動
.\run.ps1
```

- `API_KEY` は環境変数または `.env`（推奨）で設定
- デフォルト: `0.0.0.0:8765`
- DBファイル: `hc_sync.db`（このフォルダ）

### 手動起動（任意）
```powershell
$env:API_KEY = "<shared-secret>"
python server.py
```

## 3) 動作確認
- ダッシュボード：`http://localhost:8765/ui`
- API（要 `X-Api-Key`）：
  - `GET http://localhost:8765/api/status`
  - `GET http://localhost:8765/api/summary`
  - `POST http://localhost:8765/api/intake`（日次の摂取カロリーを入力）
  - `GET http://localhost:8765/api/export.csv`

補助：
- IP候補表示：

```powershell
.\show-ip.ps1
```

- 参考：`http://localhost:8765/docs`（Swagger UI）
- 代替：LANで名前解決できる場合は `http://<PC名>:8765` でもOK

### 摂取カロリー入力（OpenClaw連携想定）
`/ui` の「摂取カロリー入力」から登録できる。API直接利用時は以下。

```bash
curl -X POST http://localhost:8765/api/intake \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <API_KEY>" \
  -d '{"day":"2026-02-17","intakeKcal":1800,"source":"openclaw"}'
```

困ったら：`../TROUBLESHOOT.md`

## 4) IPが分からない時（自動発見）
PCサーバはUDPで自動発見できるようにしてある（同一LAN内）。
- PCは UDP 8766 を待受
- Android側がブロードキャストで `HC_SYNC_DISCOVER` を投げると、PCが `baseUrl` を返す

Android側（雛形）は `../android-app` に追加済み。

## 5) 自動起動（おすすめ）
- `WINDOWS_AUTOSTART.md` を参照（タスクスケジューラでログオン時起動）

## 6) バックアップ
- `BACKUP.md`（SQLiteファイルをコピーするだけ）

## 7) Windows注意（LANからアクセスできない時）
- Windows Defender Firewall で 8765/TCP と 8766/UDP を許可する必要がある場合あり

```powershell
# 管理者PowerShellで実行
.\firewall-allow.ps1 -Port 8765 -DiscoveryPort 8766
```

- PCのIPが変わる場合はルータで固定するか、Android側で送信先を変更できるようにする
