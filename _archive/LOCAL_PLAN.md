# ローカル運用プラン（クラウド停止版）

目的
- Android(Health Connect) → **LAN経由**でPCに毎日1回送信し、PC側でSQLiteに蓄積。
- 可能な限り0円で回す。

## 構成
- Androidアプリ（Health Connect SDK / WorkManager）
- PCサーバ（FastAPI）
  - 保存：SQLite（生payloadをJSONとして格納）
  - エクスポート：CSV

## API
- OpenAPI: `openapi-local.yaml`
- エンドポイント
  - `POST /api/sync`
  - `GET /api/status`
  - `GET /api/export.csv`
- 認証：`X-Api-Key: <shared secret>`

## 運用
- PCは同一LAN上で起動しておく（常時 or 同期したい時間帯）
- Androidは
  - 1日1回のPeriodic同期（WorkManager）
  - 併せてアプリ起動時にも同期（確実化）
  - 取りこぼし防止のため lastSync から数分重ねて再同期（upsertで重複排除）
- PCのIPが変わる問題は
  - ルータ側でDHCP固定（推奨）
  - もしくはAndroid側で送信先を設定UIで変更可能にする

## 注意
- 外出先（LAN外）ではPCに送れない → 次回LAN接続時にまとめて送る（キュー/差分）設計が必要
