# 次にやること（出先から戻ったら 10〜20分）

0) GCP: Billing有効化（プロジェクト: `health-connect-bridge-haru`）
1) gcloudインストール（`deploy/INSTALL_GCLOUD.md`）
2) Firestore作成（Native mode / `asia-northeast1` 東京）※Consoleで作るのが確実
3) デプロイ
```powershell
cd projects/health-connect-sync/deploy
.\deploy.ps1
```
4) Cloud Run URL が出たら、
- `POST /v1/register` → `deviceId`/`deviceToken`取得
- 取得できたら `REGISTER_ENABLED=false` に切り替え（DEPLOY_GCP.md参照）

※このチャンネルにはトークン等の秘密情報は貼らない（DM/ローカルで扱う）
