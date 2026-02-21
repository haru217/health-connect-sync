# GCPインフラ実装プラン（MVP / 低コスト）

前提
- projectId: `health-connect-bridge-haru`
- region: `asia-northeast1`（東京）
- 構成：Cloud Run + Firestore

## 1. コスト暴発対策（先にやる）
- Billing budget（例：月500円）を作成し、メール通知
- Cloud Run の max instances を 1〜2 に制限
- ログ出力でpayloadを吐かない（サイズ/コスト対策）

## 2. 有効化するAPI
- Cloud Run
- Artifact Registry（コンテナ）
- Firestore
- Secret Manager（任意）

## 3. Firestore
- Native mode
- ロケーション：`asia-northeast1`
- コレクション：devices / syncRuns / healthRecords

## 4. Cloud Run
- サービス名例：`hc-sync-api`
- エンドポイント：/health /v1/register /v1/sync
- 環境変数：
  - `TOKEN_PEPPER`（token hash用のpepper）
  - `REGISTER_ENABLED=true/false`（初回セットアップ後にfalse推奨）

## 5. セキュリティ
- HTTPSのみ
- deviceTokenはサーバでhash（pepper+salt）保存、生は保存しない
- /v1/sync は Bearer 必須

## 6. 運用
- /health で疎通
- 401/400/413 のときアプリ側でリトライ制御
