# 本番サイト同期 + Android APK強化

- 依頼者: Claude (CTO)
- 担当: Codex-shinsekai
- 優先度: high
- 日付: 2026-03-02

## 背景

1. ローカルと本番Vercelに3コミット差分 → 本番デプロイ必要
2. Android APKの権限が不足（17種→旧APKの20種+α＝全種に拡張）
3. 現APK（android-sync）に旧APK（android-app）の安定同期ロジック（時間窓チャンク・自動再キュー）が移植されていない

---

## タスク1: 本番Vercelデプロイ

### 現状
- ローカルは `origin/main` より3コミット先行
- 本番サイトのタブ名が古い（健康/運動/ホーム/食事/AIカルテ）
- 健康タブでCORSエラー発生

### 手順
1. `git push origin main`
2. Vercel自動デプロイ確認。されない場合: `cd web-app && npx vercel --prod --yes`
3. Vercel環境変数確認: `cd web-app && npx vercel env ls`
   - `VITE_API_URL` = `https://health-connect-sync-api.kokomaru3-healthsync.workers.dev`
   - `VITE_API_KEY` が設定されていること
4. 本番サイトで全5タブが正常表示、CORSエラーなしを確認

### 受入条件
- [ ] 3コミットがリモートにpush済み
- [ ] 本番サイトのタブ名がローカルと一致（コンディション/アクティビティ/ホーム/食事/プロフィール）
- [ ] 全タブでAPIエラー・CORSエラーなし

---

## タスク2: Android APK — Health Connect権限の全種追加

### 現状（android-sync: 17権限）
```
READ_STEPS, READ_WEIGHT, READ_SLEEP, READ_HEART_RATE, READ_EXERCISE,
READ_ACTIVE_CALORIES_BURNED, READ_DISTANCE, READ_TOTAL_CALORIES_BURNED,
READ_SPEED, READ_RESTING_HEART_RATE, READ_BLOOD_PRESSURE,
READ_OXYGEN_SATURATION, READ_BODY_TEMPERATURE, READ_BASAL_BODY_TEMPERATURE,
READ_BASAL_METABOLIC_RATE, READ_HEIGHT, READ_BODY_FAT
```

### 追加する権限（旧APKにあったもの + 追加候補）
```
READ_SKIN_TEMPERATURE      ← 旧APKにあった
READ_RESPIRATORY_RATE      ← 旧APKにあった
READ_BLOOD_GLUCOSE         ← 旧APKにあった
READ_LEAN_BODY_MASS        ← 旧APKにあった
READ_HYDRATION             ← 新規追加（水分摂取）
READ_NUTRITION             ← 新規追加（栄養データ）
READ_BONE_MASS             ← 新規追加（骨量）
READ_MENSTRUATION          ← 新規追加（月経、該当なくても宣言しておく）
READ_POWER                 ← 新規追加（運動パワー）
READ_FLOORS_CLIMBED        ← 新規追加（階段）
READ_ELEVATION_GAINED      ← 新規追加（高度上昇）
READ_WHEELCHAIR_PUSHES     ← 新規追加（車椅子、該当なくても可）
READ_VO2_MAX               ← 新規追加（最大酸素摂取量）
READ_INTERMENSTRUAL_BLEEDING ← 新規追加
READ_OVULATION_TEST        ← 新規追加
READ_CERVICAL_MUCUS        ← 新規追加
READ_SEXUAL_ACTIVITY       ← 新規追加
```

**注意**: Health Connect SDK alpha07で利用可能なREAD権限を全て網羅すること。上記は候補リストであり、SDK APIドキュメントで実在を確認してから追加する。存在しないものはスキップ。

### 修正対象ファイル
1. `android-sync/app/src/main/AndroidManifest.xml` — uses-permission追加
2. `android-sync/app/src/main/java/com/healthai/sync/sync/HealthSyncRunner.kt` — requiredPermissions セットに追加
3. `android-sync/app/src/main/java/com/healthai/sync/health/HealthConnectReader.kt` — 新レコードタイプの読み取り・マッピング関数を追加

### 受入条件
- [ ] SDK alpha07で有効な全READ権限が宣言されている
- [ ] 対応するレコードタイプが HealthConnectReader で読み取れる
- [ ] APKがビルドできる（`./gradlew assembleDebug`）
- [ ] 権限ダイアログで全権限が表示される

---

## タスク3: Android APK — 同期ロジックの安定化（旧APKからの移植）

### 問題
現APKは大量データを一括取得→一括送信する設計で、以下のリスクがある:
- 大量データでメモリ不足やタイムアウト
- 途中で失敗するとカーソルが保存されず次回また全データ再取得
- 自動的に追い付く仕組みがない（手動で何回もSync押す必要あり）

### 旧APKのロジック（移植元）
ファイル: `android-app/app/src/main/java/com/haru/hcsyncbridge/sync/SyncWorker.kt`

旧APKの設計:
```
1. カーソル（最終同期時刻）を取得
2. カーソル〜現在を24時間の「窓」に分割
3. 1回の同期で最大3窓を処理
4. 各窓の完了ごとにカーソルを保存
5. まだ追いつけていなければ自動で次の同期をスケジュール
```

### 現APKへの移植内容

`android-sync/app/src/main/java/com/healthai/sync/sync/HealthSyncRunner.kt` を修正:

#### 3-A: 時間窓チャンク導入
```
変更前: start〜endの全レコードを一括読み取り
変更後: start〜endを24時間窓に分割し、窓ごとにread→chunk→send
```
- 窓サイズ: 24時間
- 1回の同期で最大3窓
- 旧APKの該当コード: SyncWorker.kt 96行目付近

#### 3-B: 窓ごとのカーソル保存
```
変更前: 全完了時のみ settings.saveSyncOutcome()
変更後: 各窓の送信完了時に settings.saveSyncOutcome() で中間保存
```
- これにより途中失敗しても、完了した窓分のカーソルは保存される
- 旧APKの該当コード: SyncWorker.kt 107行目付近

#### 3-C: 自動再キュー
```
変更前: なし（1回で終了）
変更後: 3窓処理後にまだデータが残っていれば、SyncSchedulerで次の同期をスケジュール
```
- 旧APKの該当コード: SyncWorker.kt 114行目付近、SyncNow.kt

#### 3-D: 初回遡り期間を30日に変更
```
変更前: 7日
変更後: 30日
```
- 旧APKに合わせる。初回インストール時に十分な履歴データを取得するため

#### 3-E: リトライ強化
```
変更前: 2回、50件超で分割
変更後: 4回、1件超で分割、バックオフ 1s→2.5s→5s→8s→12s
```
- 旧APKに合わせる

### 参照ファイル（旧APK → 移植元）
- `android-app/app/src/main/java/com/haru/hcsyncbridge/sync/SyncWorker.kt` — メイン同期ロジック
- `android-app/app/src/main/java/com/haru/hcsyncbridge/sync/SyncNow.kt` — 再キューロジック

### 参照ファイル（現APK → 修正先）
- `android-sync/app/src/main/java/com/healthai/sync/sync/HealthSyncRunner.kt` — メイン修正対象
- `android-sync/app/src/main/java/com/healthai/sync/sync/SyncWorker.kt` — WorkManager連携
- `android-sync/app/src/main/java/com/healthai/sync/sync/SyncScheduler.kt` — スケジューラ
- `android-sync/app/src/main/java/com/healthai/sync/health/HealthConnectReader.kt` — HC読み取り

### 受入条件
- [ ] 24時間窓でデータを分割取得している
- [ ] 各窓完了ごとにカーソルが保存される
- [ ] 3窓処理後にデータ残りがあれば自動再キューされる
- [ ] 初回遡りが30日
- [ ] リトライ4回、1件超でバイナリ分割
- [ ] 既存のカーソル修復機能（repairCursorFromServer）は維持

---

## タスク4: ビルド・検証

1. `cd android-sync && ./gradlew assembleDebug` でビルド成功
2. 端末にインストールして全権限を許可
3. 同期実行 → Cloudflare APIにデータが入ることを確認
4. 本番サイトのプロフィール画面で「不足あり」が消えること
5. アクティビティタブでエクササイズ履歴が表示されること（運動記録がある日）
6. handoff/incoming/ にハンドオフを書く
7. ダッシュボードを更新:
   ```powershell
   .\ops\update-ceo-dashboard.ps1 -Type screen -Name "ホーム画面" -ScreenStatus ok -Summary "本番デプロイ完了、全データ表示OK" -Actor Codex-shinsekai
   ```

---

## 優先順位

1. タスク1（本番デプロイ）— すぐできる、git push のみ
2. タスク3（同期ロジック安定化）— 最重要、データ取得の安定性に直結
3. タスク2（権限全種追加）— タスク3と同時に実装可能
4. タスク4（検証）— 全タスク完了後
