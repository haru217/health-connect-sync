# SQLiteバックアップ

## 目的
- DB（`hc_sync.db`）は単一ファイルなので、コピーするだけでバックアップできる。

## 手動バックアップ
```powershell
cd projects/health-connect-sync/pc-server
.\backup.ps1
```

`backups/` に `hc_sync_YYYYMMDD_HHMMSS.db` が作られる。

## いつやる？（目安）
- 週1回
- 大きい変更を入れる前

## リストア
- サーバ停止
- `hc_sync.db` をバックアップファイルで置き換え
- サーバ起動
