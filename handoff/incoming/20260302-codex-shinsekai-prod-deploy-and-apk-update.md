# Handoff: 本番デプロイ + Android APK更新確認

- Date: 2026-03-02
- From: Codex-shinsekai
- To: Claude (CTO) / CEO
- Request file: `requests/codex-shinsekai/20260302-prod-deploy-and-apk-update.md`
- Status: `partial-done`

## Summary
本番反映タスクは完了しました。`main` の3コミットを `origin/main` に push し、Vercel 本番を手動デプロイして `web-app-jet-chi.vercel.app` が最新デプロイを指すことを確認済みです。  
Android については `assembleRelease` に成功し APK 生成まで完了しましたが、ADB接続端末が無いため、実機での 17/17 権限付与と同期確認は未実施です。

## Work done
- `git push origin main` 実行
  - `3194487..aedd747  main -> main`
- Vercel 本番手動デプロイ実行
  - Command: `cd web-app && npx vercel --prod --yes`
  - Production URL: `https://web-ek769s7nf-kokomaru3-9320s-projects.vercel.app`
  - Alias確認: `web-app-jet-chi.vercel.app` が上記デプロイを指す
- Vercel 環境変数確認
  - `VITE_API_URL` = `https://health-connect-sync-api.kokomaru3-healthsync.workers.dev`
  - `VITE_API_KEY` が Production に設定済み
- 本番画面検証（Playwright）
  - 5タブ名: `コンディション / アクティビティ / ホーム / 食事 / プロフィール`
  - Console error: 0件（CORSエラーなし）
  - API通信: 主要エンドポイントがすべて `200`
- Android APKビルド検証
  - Command: `cd android-sync && ./gradlew assembleRelease`
  - 終了コード: `0`
  - 生成物: `android-sync/app/build/outputs/apk/release/app-release-unsigned.apk`
  - サイズ: `8,886,164 bytes`

## Verification details
- Web:
  - `npx vercel inspect web-app-jet-chi.vercel.app` -> `status: Ready`
  - `browser_network_requests`:
    - `GET /api/home-summary` `200`
    - `GET /api/body-data` `200`
    - `GET /api/summary` `200`
    - `GET /api/nutrition/day` `200`
    - `GET /api/supplements` `200`
    - `GET /api/nutrients/targets` `200`
    - `GET /api/connection-status` `200`
- Android:
  - `Get-Item app-release-unsigned.apk` で成果物の存在と更新時刻を確認

## Blockers
- ADB接続端末なし（`adb devices -l` が空）
  - 未完了項目:
    - Health Connect 権限 17/17 付与確認
    - 同期実行後の Exercise session データの API 格納確認
    - プロフィール画面「不足あり」解消の最終確認

## Next actions
1. 実機を ADB 接続し、`app-release-unsigned.apk` をインストール
2. Health Connect の17権限をすべて許可（特に `READ_EXERCISE` / `READ_BODY_TEMPERATURE` / `READ_BASAL_BODY_TEMPERATURE`）
3. 同期実行後、プロフィール画面が `17/17` になることと API 側の Exercise データ保存を確認
