# Troubleshoot（ローカル同期）

## 0. まず確認する順番（最短）
1) PCサーバが起動しているか
- PCで `projects/health-connect-sync/pc-server/run.ps1`
- ブラウザで `http://localhost:8765/ui` が開く

2) Androidアプリの「Test」が通るか
- baseUrl と API_KEY を入れて `Test`

3) Androidアプリの「Check Health Connect」で
- HC SDK: AVAILABLE
- permissions: allGranted=true

---

## A. Android → PC に届かない
### A1) `NETWORK: Unknown host (PC name/IP?)`
- baseUrl のホスト名が解決できていない。
対策：
- `http://<PCのIPv4>:8765` を使う
- PCで `pc-server/show-ip.ps1` を実行してIPv4候補を確認
- それでもダメならルータ側で「端末間通信禁止(AP isolation)」がONの可能性

### A2) `NETWORK: Connection refused (server running? firewall?)`
- PCサーバが起動していない、またはFirewallでブロック。
対策：
- PCで `run.ps1` が動いているか
- 管理者PowerShellで `pc-server/firewall-allow.ps1 -Port 8765 -DiscoveryPort 8766`
- Windows Defender Firewall のプロファイルが Private か確認

### A3) `NETWORK: Timeout (same Wi-Fi? server reachable?)`
- 同一Wi‑Fiではない / ルータ設定 / Firewall / PCがスリープ。
対策：
- スマホがモバイル回線になってないか（Wi‑Fiアイコン確認）
- ルータでAP isolationをOFF
- PCのスリープを無効化（同期時間帯だけでも）

---

## B. Discovery（Discover PC）で見つからない
- UDP 8766 が通らないと見つからない。
対策：
- `firewall-allow.ps1` で UDP 8766 を許可
- AP isolation がONだとブロードキャストが届かない場合あり
- 代替：手動で baseUrl に `http://<PC-IP>:8765` を入れる

---

## C. 認証エラー（AUTH）
### C1) `AUTH: Invalid API key`
- AndroidのAPI_KEYとPCサーバのAPI_KEYが一致していない。
対策：
- PCの `pc-server/.env` の `API_KEY` を確認
- Androidの設定画面のAPI keyを一致させて `Save`

---

## D. Health Connect が使えない
### D1) `HC_UNAVAILABLE`
- 端末にHealth Connectが無い/無効。
対策：
- Play Store で Health Connect を有効化/更新

### D2) `HC_UPDATE_REQUIRED`
- 提供元の更新が必要。
対策：
- Health Connect を更新

### D3) `PERMISSION_MISSING`
- 許可が足りない。
対策：
- Androidアプリで `Grant Health Connect permissions`
- Health Connect 設定画面で当アプリに許可が付いているか確認

---

## E. HTTPがブロックされる（Android側）
- ローカルは `http://` を使うため、Android側で cleartext を許可している必要がある。
本プロジェクトは `AndroidManifest.xml` に `usesCleartextTraffic=true` を設定済み。

---

## F. データが入ってるのにダッシュボードに出ない
- `/ui` の Counts by type に目的の Record（例：WeightRecord）が無い場合：
  - そもそも同期できてない（Test/Sync nowを確認）
  - Record typeが空（データ提供元がまだ出してない）
  - 権限不足

- あるのにグラフが空の場合：
  - payload構造が想定と違う
  - `pc-server/app/summary.py` の抽出ロジックを調整する

診断：
- `GET /api/export.csv?type=WeightRecord` を取得して payload_json を見る
