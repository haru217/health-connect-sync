# Health Connect Sync Bridge — 仕様書（v0.1 / Draft）

## 0. 要約
Android端末の Health Connect から取得できるヘルスデータを「毎日1回バックグラウンドで差分同期」し、**LAN経由でPCローカルサーバへ転送・蓄積**する“同期専用”アプリ。
MVPでは確認用ダッシュボードは作らず、UIは権限・同期状態・エラーのみ。

---

## 1. ゴール / 非ゴール
### ゴール
- Health Connectのデータを **漏れなく取得（取得可能なRecord typeを列挙して許可・取得）**
- **1日1回のバックグラウンド同期**（＋手動同期）
- サーバへ **差分同期**して蓄積（後続で分析・レポ生成が可能な形）

### 非ゴール（MVPではやらない）
- アプリ内のグラフ/分析/レコメンド
- 複数ユーザー/アカウント管理
- 完全リアルタイム同期

---

## 2. 想定ユーザー
- 単一ユーザー（haru2022）
- 端末：Android 15

---

## 3. 全体アーキテクチャ
- Androidアプリ（Kotlin推奨）
  - Health Connect SDK
  - WorkManager（PeriodicWorkRequest）
  - 設定/状態：DataStore（Preferences）
  - ローカル永続化：MVPでは不要（lastSyncのみ保持）
  - 実装場所：`android-app/`（Android Studioプロジェクト雛形）
- PCローカルサーバ（新規）
  - Ingestion API（HTTP/LAN）
  - DB：SQLite（時系列を保持）
  - 管理用エンドポイント：status/summary/export + UI
  - 実装場所：`pc-server/`

---

## 4. Androidアプリ仕様
### 4.1 画面（MVP）
- 権限状態（未許可/一部許可/許可済み）
- 最終同期時刻（lastSyncAt）
- 最終同期結果（成功/失敗・エラー内容）
- 「今すぐ同期」ボタン
- （任意）「送信先URL表示」「デバイスID表示」

### 4.2 権限（Health Connect）
- 方針：**取得可能なRecord typeはすべて要求**
- 実装：アプリ内で対象Record typeのリストを管理し、権限要求・クエリを順次実施
  - SDK差分で存在しないRecordがあるとビルドが落ちうるため、`androidx.health.connect...Record` を **FQCN文字列から動的ロード**して存在するものだけ対象にする
- 補足：端末状態や提供元アプリによってはデータが存在しないtypeがある（その場合は空でOK）

カテゴリ例（実際はHealth ConnectのRecord class単位で列挙）
- Activity（Steps, Distance, ActiveCaloriesBurned など）
- Body Measurements（Weight, BodyFat など）
- Sleep（SleepSession など）
- Vitals（HeartRate, RestingHeartRate, BloodPressure など）
- Nutrition（MVPでは“読めるなら読む”。入力UIは作らない）

### 4.3 同期スケジュール
- バックグラウンド：1日1回
  - WorkManager periodic（24h間隔）
  - 制約：Network connected を必須（Wi‑Fi限定/充電中は要相談、v0.1は不要）
  - 注：Androidは「毎日○時固定」は保証不可（WorkManagerの仕様）
- 手動同期：ボタンで即時OneTimeWorkRequest

### 4.4 同期方式（差分）
- ローカルに `lastSuccessfulSyncAt` を保持
- 同期対象時間範囲：
  - `rangeStart = (lastSuccessfulSyncAt - 5分のオーバーラップ) ?? initialBackfillStart`
  - `rangeEnd = now()`
- 重複排除：サーバ側upsert（recordKey）で冪等
- 初回バックフィル：デフォルト **直近90日**
  - 理由：過去全量は重くなりがち。必要ならサーバ側で後追い拡張。

### 4.5 冪等性・再送
- 端末側：送信失敗時はWorkManagerのリトライ（指数バックオフ）
- サーバ側：
  - `syncId`（UUID）で1回の同期単位を識別
  - 各recordに `recordKey` を付与し **upsert** で重複排除

### 4.6 ローカル保存（Room）
- lastSync管理
- 送信キュー（MVPでは“同期1バッチ=1送信”でOK、キューは最小でも可）

---

## 5. サーバ仕様（採用：PCローカル FastAPI + SQLite / 0円運用優先）
### 5.1 構成
- PCサーバ：FastAPI（LANで待ち受け）
- DB：SQLite（ローカルファイル）
- CSVエクスポート：HTTPで取得

コスト方針：
- クラウドは一旦使わない（Billing不要）

### 5.2 認証（MVP）
- 共有シークレット方式：`X-Api-Key: <secret>`
  - PCがLAN内にいる前提でも最低限の保険として入れる
  - secretはPC側の環境変数 `API_KEY` で設定

実装（PCサーバ）
- `pc-server/`（このリポジトリ内）
- OpenAPI：`openapi-local.yaml`

---

## 6. API仕様（Draft）
OpenAPI定義：`openapi-local.yaml`（このディレクトリ）

- `POST /api/sync`
  - Auth：`X-Api-Key`
- `GET /api/status`
  - Auth：`X-Api-Key`
- `GET /api/export.csv`
  - Auth：`X-Api-Key`

※クラウド案（`openapi.yaml`）は一旦保留。- Request（JSON）例：
  - `deviceId`
  - `syncId`（UUID）
  - `syncedAt`（ISO8601）
  - `rangeStart` / `rangeEnd`
  - `records`: Array

record共通フィールド案：
- `type`（例："Steps"）
- `startTime` / `endTime`（or time）
- `value`（数値/構造体）
- `unit`（例：count, kcal, kg, bpm）
- `source`（Health Connect dataOrigin package）
- `recordId`（Health Connect metadata.id 等）
- `lastModifiedTime`

Response：
- `accepted: true`
- `upsertedCount`
- `skippedCount`

### 6.3 Health check
- `GET /health` → 200 OK

---

## 7. DBスキーマ（概略 / SQLite）
テーブル案：
- `sync_runs`
  - `sync_id` (PK)
  - `device_id`
  - `synced_at`, `range_start`, `range_end`, `received_at`
  - `record_count`, `upserted_count`, `skipped_count`
- `health_records`
  - `record_key` (PK)
  - `device_id`, `type`
  - `record_id`, `source`
  - `start_time`, `end_time`, `time`, `last_modified_time`, `unit`
  - `payload_json`（JSON文字列）
  - `ingested_at`

冪等性（recordKey）
- `recordKey` が来ればそれを採用
- 無ければ `hash(deviceId + type + recordId + source + time + payload)` を計算して upsert
- SQLiteは `ON CONFLICT(record_key) DO UPDATE` で重複排除

---

## 8. プライバシー / セキュリティ
- LAN運用でも最低限の認証：`X-Api-Key`
- サーバは原則 **LAN内のみ** で待ち受け（外部公開しない）
- 注意：Healthデータには機微情報が含まれる可能性があるため、MVPでもログ出力に生データを出さない
- 退避/削除：SQLiteファイル単位で退避/削除が可能（運用が簡単）

---

## 9. 運用・観測
- サーバ：リクエスト数、エラー率、レイテンシ、upsert件数をログ
- アプリ：最終同期成功/失敗理由を保持（UIに表示）

---

## 10. 受け入れ条件（MVP）
- 初回セットアップで権限を付与できる
- 1日1回（目安）でバックグラウンド同期が走り、サーバにデータが蓄積される
- 手動「今すぐ同期」で即時送信できる
- エラー時にUIで原因が分かる（例：ネットワークなし、権限なし、401）

---

## 11. 決定事項 / 未決事項
### 決定（合意済み）
- 初回バックフィル期間：**直近90日**
- MVPは確認画面なし（同期ブリッジ専用）
- **クラウドは一旦やめてPCローカルに振り切る（LAN送信 + SQLite）**
- 取得データは優先付けせず、**取得可能なRecord typeは全部読む**

### 未決（必要になったら決める）
- 同期時の端末条件：Wi‑Fi限定/充電中限定にするか
- LAN外（外出先）での同期をどう扱うか（キューで持ち帰り同期、もしくは将来クラウド復活）
