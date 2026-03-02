# Handoff: Android APK強化（権限全種拡張 + 同期安定化）

- Date: 2026-03-02
- From: Codex-shinsekai
- To: Claude (CTO) / CEO
- Request file: `requests/codex-shinsekai/20260302-prod-deploy-and-apk-update.md`
- Status: `done-with-device-check-pending`

## Summary
`android-sync` に対して、Health Connect read権限の拡張と同期ロジックの安定化を実施した。  
旧 `android-app` の同期方針（24h窓・3窓上限・中間カーソル保存・追いつき再キュー・30日遡り）を `HealthSyncRunner` ベースに移植済み。

## Implemented changes
- 権限・レコード種別の一元管理を追加
  - `android-sync/app/src/main/java/com/healthai/sync/health/HealthRecordRegistry.kt`
  - alpha07 の concrete record を列挙し、`HealthPermission.getReadPermission()` で required 権限集合を生成
- Manifest の READ権限を拡張
  - 既存17種 + 追加18種（`READ_BLOOD_GLUCOSE`, `READ_RESPIRATORY_RATE`, `READ_NUTRITION`, `READ_HYDRATION`, `READ_POWER`, `READ_FLOORS_CLIMBED`, `READ_ELEVATION_GAINED`, `READ_WHEELCHAIR_PUSHES`, `READ_VO2_MAX`, `READ_INTERMENSTRUAL_BLEEDING`, `READ_OVULATION_TEST`, `READ_CERVICAL_MUCUS`, `READ_SEXUAL_ACTIVITY`, `READ_BODY_WATER_MASS`, `READ_BONE_MASS`, `READ_LEAN_BODY_MASS`, `READ_MENSTRUATION`, `READ_HEART_RATE_VARIABILITY`）
- HealthConnectReader 拡張
  - 既存17種の明示マッピングは維持
  - 追加レコードは generic mapper で envelope 化し読取可能化
- 同期安定化（`HealthSyncRunner.kt`）
  - 初回遡り: 7日 -> 30日
  - 24h窓で分割処理、1回最大3窓
  - 窓完了ごとに `saveSyncOutcome()`（中間カーソル保存）
  - 追いついていなければ `SyncScheduler.enqueueCatchUpNow()` で自動再キュー
  - リトライ強化: 2回/50件閾値 -> 4回/1件閾値、backoff `1s -> 2.5s -> 5s -> 8s -> 12s`
  - 既存 `repairCursorFromServer()` は維持
- Scheduler 拡張
  - `SyncScheduler.kt` に one-shot 再キュー用 `enqueueCatchUpNow()` を追加

## Verification
- Build command:
  - `cd android-sync && ./gradlew assembleDebug`
- Result:
  - `BUILD SUCCESSFUL`
  - Exit code `0`
  - APK: `android-sync/app/build/outputs/apk/debug/app-debug.apk`

## Notes
- `HealthPermission` の READ 定数を alpha07 AAR (`connect-client-1.1.0-alpha07`) で確認した結果、`READ_HIP_CIRCUMFERENCE` と `READ_WAIST_CIRCUMFERENCE` は record class が同AARに存在しないため、今回の reader 対応対象から除外。

## Pending manual checks
1. 実機インストール後、権限ダイアログで拡張権限が表示されること
2. 同期後、プロフィール画面で不足権限表示が解消されること
3. アクティビティのエクササイズ履歴反映（記録日で確認）
