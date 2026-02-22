# Codex 実装指示書 — Step 4: 新 Android 同期アプリ

対象タスク: T15〜T19

---

## 概要

Health Connect からデータを読み取り、Fly.io へ POST する**軽量な Android アプリ**を新規作成する。

**既存の `android-app/` は使わない**（PC ローカル接続前提の設計になっており、UDP 探索など不要な複雑さがある）。

---

## 新規プロジェクトの作成先

```
health-connect-sync/android-sync/   ← 新規作成
```

（既存の `android-app/` はアーカイブとして残す）

---

## 機能要件（最小限）

| # | 機能 | 優先度 |
|---|---|---|
| F01 | Health Connect から歩数・体重・睡眠・心拍を読み取る | 必須 |
| F02 | 固定の Fly.io URL（`https://health-ai.fly.dev/api/sync`）へ POST | 必須 |
| F03 | WorkManager で定期自動実行（1回/日）| 必須 |
| F04 | 設定画面で APIキー を入力・保存できる | 必須 |
| F05 | 手動同期ボタン（即時実行） | 必須 |
| F06 | 最終同期日時の表示 | 推奨 |

---

## 使わない機能（実装しないこと）

- UDP サーバー探索（`ServerDiscovery`）→ 固定 URL のみ
- Room DB キャッシュ → MVP では不要
- 複雑な UI → シンプルな設定画面のみ
- ローカル PC への接続機能

---

## 技術スタック

| 項目 | 採用 |
|---|---|
| 言語 | Kotlin |
| UI | Jetpack Compose（最小限） |
| 非同期 | Coroutines + WorkManager |
| HTTP | OkHttp または Ktor Client |
| ストレージ | DataStore（APIキー保存） |
| Health Connect | `androidx.health.connect:connect-client` |
| 最小 Android バージョン | API 26（Android 8.0）|

---

## T15: プロジェクト新規作成

Android Studio で新規プロジェクトを作成する：

```
Project name: HealthSync
Package name: com.healthai.sync
Save location: health-connect-sync/android-sync/
Language: Kotlin
Minimum SDK: API 26
Template: Empty Activity（Compose）
```

### build.gradle.kts の依存関係

```kotlin
dependencies {
    // Health Connect
    implementation("androidx.health.connect:connect-client:1.1.0-alpha10")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // DataStore（設定保存）
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // HTTP クライアント
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.8.2")

    // ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
}
```

---

## T16: Health Connect 読み取り実装

### AndroidManifest.xml

```xml
<!-- Health Connect 権限 -->
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />

<!-- Health Connect intent filter -->
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
  </intent-filter>
</activity>
```

### HealthConnectReader.kt

読み取り対象とデータ型:

| Health Connect 型 | 取得内容 | 送信フィールド |
|---|---|---|
| `StepsRecord` | 歩数 | `type: "Steps"`, `count`, `startTime`, `endTime` |
| `WeightRecord` | 体重 | `type: "Weight"`, `weight.inKilograms`, `time` |
| `SleepSessionRecord` | 睡眠 | `type: "SleepSession"`, `startTime`, `endTime` |
| `HeartRateRecord` | 心拍 | `type: "HeartRate"`, `samples[]`, `startTime`, `endTime` |

読み取り期間: 最新 7 日間（または最終同期日時以降）

### 権限チェック

```kotlin
val status = HealthConnectClient.sdkStatus(context)
if (status != HealthConnectClient.SDK_AVAILABLE) {
    // Health Connect 未対応 or 未インストールを UI に表示
    return
}
```

---

## T17: Fly.io への POST 実装（WorkManager）

### SyncWorker.kt

```kotlin
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val apiKey = // DataStore から取得
        val records = // HealthConnectReader で取得

        val payload = buildJsonPayload(records)

        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://health-ai.fly.dev/api/sync")
            .addHeader("X-Api-Key", apiKey)
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()

        return try {
            val response = client.newCall(request).execute()
            if (response.isSuccessful) Result.success()
            else Result.retry()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
```

### WorkManager スケジューリング

```kotlin
// 1日1回、バックグラウンド同期
val syncWork = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.DAYS)
    .setConstraints(
        Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
    )
    .build()

WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "health_sync",
    ExistingPeriodicWorkPolicy.KEEP,
    syncWork
)
```

### 送信ペイロード

既存の `/api/sync` エンドポイントが受け取る形式に合わせる：

```json
{
  "deviceId": "<Android デバイスID>",
  "syncedAt": "2026-02-22T10:00:00Z",
  "rangeStart": "2026-02-15T00:00:00Z",
  "rangeEnd": "2026-02-22T23:59:59Z",
  "records": [
    {
      "type": "Steps",
      "recordId": "...",
      "startTime": "2026-02-22T08:00:00Z",
      "endTime": "2026-02-22T09:00:00Z",
      "payload": {"count": 3200}
    },
    ...
  ]
}
```

---

## T18: 設定画面実装

シンプルな1画面構成：

```
┌─────────────────────────────┐
│  Health Sync                │
│                             │
│  API キー                   │
│  [____________________]     │
│                             │
│  サーバー URL               │
│  https://health-ai.fly.dev  │
│  （変更不可・表示のみ）      │
│                             │
│  [ 今すぐ同期する ]         │
│                             │
│  最終同期: 2026-02-22 10:00 │
│  同期結果: 成功（142 件）   │
│                             │
│  Health Connect 権限        │
│  [ 権限を確認・設定 ]       │
└─────────────────────────────┘
```

### 設定保存

`DataStore<Preferences>` を使って APIキーを保存する（SharedPreferences は使わない）。

---

## T19: APK ビルド & インストール

```bash
# デバッグ APK ビルド
./gradlew assembleDebug

# ADB でインストール（USB デバッグ有効時）
adb install app/build/outputs/apk/debug/app-debug.apk
```

または Android Studio の「Run」ボタンで直接実機インストールする。

---

## 完了条件

- [ ] アプリが Android スマホにインストールできる
- [ ] Health Connect の権限を付与できる
- [ ] 設定画面で APIキーを入力・保存できる
- [ ] 「今すぐ同期する」ボタンを押すと Fly.io にデータが届く
- [ ] Fly.io の `/api/summary` でデータが反映されていることを確認できる
- [ ] WorkManager で 1日1回のバックグラウンド同期が登録される

---

## 注意事項

- Health Connect はリアルタイムデータ取得ではなく、バッチ読み取り
- Health Connect SDK はバージョンによって API が変わるため、最新の公式ドキュメントを参照すること
  - https://developer.android.com/health-and-fitness/guides/health-connect
- デバッグ時は `flyctl logs` でサーバー側のログを確認する
- `recordId` がある場合は冪等キー（`record_key`）として使われるため、重複 POST しても安全
