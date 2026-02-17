# Windows 自動起動（タスクスケジューラ）

目的：PCサーバを「ログオン時に自動起動」させて、毎日同期が勝手に回る状態にする。

## 前提
- このフォルダ：`projects/health-connect-sync/pc-server`
- 先に手動で `run.ps1` が動くことを確認しておく

## 1) API_KEY を .env に保存（必須）
スケジュール実行は入力プロンプトが出せないので、`.env` に入れる。

1. `pc-server/.env.example` をコピーして `.env` を作成
2. `API_KEY=...` を設定

例：
```text
API_KEY=your-secret
PORT=8765
HOST=0.0.0.0
DB_PATH=hc_sync.db
```

## 2) Firewall（必要なら）
管理者PowerShellで：
```powershell
cd projects/health-connect-sync/pc-server
.\firewall-allow.ps1 -Port 8765 -DiscoveryPort 8766
```

## 3) タスクをインストール
PowerShellで（通常権限でOK）：
```powershell
cd projects/health-connect-sync/pc-server
.\task-install.ps1
```

これで「ログオン時」に自動起動する。

## 4) 動作確認
- 一度ログオフ→ログオン（またはPC再起動）
- ブラウザで `http://localhost:8765/ui`

困ったら：`../TROUBLESHOOT.md`

## 5) 停止/削除
```powershell
cd projects/health-connect-sync/pc-server
.\task-remove.ps1
```

## よくあるハマり
- タスク起動してるのにLANから繋がらない
  - Windows Defender Firewall（Private profile）を確認
  - ルータ側の「AP isolation / 端末間通信禁止」がONだと不可
- `.env` が無い/ `API_KEY` 未設定
  - run.ps1 がプロンプト待ちになり、タスクでは詰まる
