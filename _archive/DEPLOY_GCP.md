# デプロイ手順（GCP / Cloud Run + Firestore）

前提
- projectId: `health-connect-bridge-haru`
- region: `asia-northeast1`（東京）
- ソース: `projects/health-connect-sync/server`

## 0) 準備
- gcloud CLI をインストール
- Googleログイン（Application Default Credentialsも後で使える）

```bash
gcloud auth login
```

## 1) プロジェクト作成 & 設定
```bash
gcloud projects create health-connect-bridge-haru

gcloud config set project health-connect-bridge-haru
```

※ Cloud Run/Firestore を使うには Billing 有効化が必要なことが多い（コンソールで紐付け）。

## 2) API有効化
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com
```

## 3) Firestore 作成（Native / 東京）
Firestoreは作成が必要（コンソールで作るのが確実）。
- Firestore Database → Create database
- Native mode
- Location: `asia-northeast1`

## 4) Cloud Run デプロイ（ソースから）
```bash
cd projects/health-connect-sync/server

# TOKEN_PEPPERはランダム文字列を推奨
TOKEN_PEPPER="<RANDOM_LONG_STRING>"

gcloud run deploy hc-sync-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars TOKEN_PEPPER=$TOKEN_PEPPER,REGISTER_ENABLED=true \
  --max-instances 1

# 任意（registerの追加ガード）
# REGISTER_KEYを入れた場合、/v1/register だけはヘッダ `X-Register-Key: <REGISTER_KEY>` が必須になる
# REGISTER_KEY="<RANDOM_SHORT_SECRET>"
# --set-env-vars TOKEN_PEPPER=$TOKEN_PEPPER,REGISTER_ENABLED=true,REGISTER_KEY=$REGISTER_KEY
```

- `--allow-unauthenticated` は **/v1/sync がBearer必須なので実質OK**
  - さらに固くするなら、後でCloud ArmorやIAMベースに移行も可

## 5) 初回デバイス登録
- `POST https://<cloud-run-url>/v1/register`
- 返ってきた `deviceId` と `deviceToken` をAndroid側で保存

登録が終わったら、registerを閉じる：
```bash
gcloud run services update hc-sync-api \
  --region asia-northeast1 \
  --set-env-vars REGISTER_ENABLED=false
```

## 6) 料金暴発対策（推奨）
- Billing → Budgets & alerts（例：月500円で通知）
- Cloud Run max instances を1のまま運用
- ログにpayloadを出さない（実装済みの方針）
