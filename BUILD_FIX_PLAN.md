# Android APK ビルド修正 & セキュリティ対応プラン

## 現状の問題

### ビルドブロッカー（APKが作れない原因）

1. **Gradle Wrapper 完全欠落** — `gradlew`, `gradlew.bat`, `gradle/wrapper/` が存在しない
2. **JAVA_HOME 未設定** — Android Studio内蔵JDK (21.0.9) はあるがパスが通っていない
3. **Health Connect Manifest宣言不足** — `<queries>`, Privacy Policy Activity未定義。Android 14+でHC権限要求が失敗する
4. **署名設定なし** — debug APKは自動署名で作れるが release 用はない

### セキュリティ問題

- S1: プロジェクトルートに `.gitignore` がない → `.env`(API_KEY), `hc_sync.db`(健康データ) がコミット対象
- S2: `OkHttpClient()` にタイムアウト未設定 → ネットワーク障害時に永久ブロック
- S3: `usesCleartextTraffic=true` がグローバル → LAN以外もHTTP許可状態

---

## Phase 1: ビルド可能にする

### 1-1. Gradle Wrapper 生成

作業ディレクトリ: `projects/health-connect-sync/android-app/`

JAVA_HOME を指定して wrapper を生成:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

もしシステムに `gradle` コマンドがあれば:
```
gradle wrapper --gradle-version 8.7
```

なければ以下の4ファイルを手動で作成する:

**`gradle/wrapper/gradle-wrapper.properties`**:
```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.7-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

**`gradle/wrapper/gradle-wrapper.jar`**: Gradle公式リポジトリから取得
```
https://github.com/gradle/gradle/raw/v8.7.0/gradle/wrapper/gradle-wrapper.jar
```

**`gradlew`**: 標準的な Unix shell wrapper script
**`gradlew.bat`**: 標準的な Windows batch wrapper script

両方とも https://github.com/gradle/gradle/tree/v8.7.0/gradle/wrapper から取得可能。

### 1-2. gradle.properties に JAVA_HOME を追加

ファイル: `android-app/gradle.properties`

既存の内容:
```
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
```

追加:
```
org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
```

### 1-3. ビルド確認コマンド

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd projects/health-connect-sync/android-app
./gradlew assembleDebug
```

成功時の出力先: `app/build/outputs/apk/debug/app-debug.apk`

---

## Phase 2: Health Connect Manifest 修正

ファイル: `android-app/app/src/main/AndroidManifest.xml`

現状:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <application
        android:allowBackup="true"
        android:label="HC Sync Bridge"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>
```

修正後:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <!-- Health Connect read permissions (runtime で要求するが宣言も必要) -->
    <uses-permission android:name="android.permission.health.READ_STEPS" />
    <uses-permission android:name="android.permission.health.READ_DISTANCE" />
    <uses-permission android:name="android.permission.health.READ_SPEED" />
    <uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
    <uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED" />
    <uses-permission android:name="android.permission.health.READ_EXERCISE" />
    <uses-permission android:name="android.permission.health.READ_SLEEP" />
    <uses-permission android:name="android.permission.health.READ_HEART_RATE" />
    <uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />
    <uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
    <uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />
    <uses-permission android:name="android.permission.health.READ_SKIN_TEMPERATURE" />
    <uses-permission android:name="android.permission.health.READ_BODY_TEMPERATURE" />
    <uses-permission android:name="android.permission.health.READ_RESPIRATORY_RATE" />
    <uses-permission android:name="android.permission.health.READ_BLOOD_GLUCOSE" />
    <uses-permission android:name="android.permission.health.READ_WEIGHT" />
    <uses-permission android:name="android.permission.health.READ_HEIGHT" />
    <uses-permission android:name="android.permission.health.READ_BODY_FAT" />
    <uses-permission android:name="android.permission.health.READ_LEAN_BODY_MASS" />
    <uses-permission android:name="android.permission.health.READ_BASAL_METABOLIC_RATE" />

    <!-- Package visibility: Health Connect (Android 11+) -->
    <queries>
        <package android:name="com.google.android.apps.healthdata" />
    </queries>

    <application
        android:allowBackup="true"
        android:label="HC Sync Bridge"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Health Connect Privacy Policy (Android 14+ で必須) -->
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".MainActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>

    </application>

</manifest>
```

---

## Phase 3: セキュリティ修正

### 3-1. プロジェクトルートに `.gitignore` 作成

ファイル: `projects/health-connect-sync/.gitignore`

```gitignore
# Secrets & data
.env
*.db

# Android
*.apk
*.aab
local.properties
.gradle/
build/
app/build/
.idea/

# Python
__pycache__/
.venv/
*.pyc

# OS
.DS_Store
Thumbs.db

# Node (mobile-app)
node_modules/
```

既にgitにコミット済みの場合:
```
git rm --cached pc-server/.env
git rm --cached pc-server/hc_sync.db
```

### 3-2. OkHttpClient タイムアウト設定

ファイル: `android-app/app/src/main/java/com/haru/hcsyncbridge/net/HttpSyncClient.kt`

変更箇所 (11行目付近):
```kotlin
// Before:
private val http: OkHttpClient = OkHttpClient(),

// After:
private val http: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
    .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
    .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
    .build(),
```

### 3-3. cleartext traffic の注意コメント

`usesCleartextTraffic=true` は LAN 内 HTTP 通信に必須なので維持する。
ただし Network Security Config でドメインベースの制限はAndroid仕様上
IPアドレス直打ちに対応できないため、マニフェストのコメントで意図を明示するのみとする。

---

## Phase 4: 不要コンポーネント整理

以下は削除推奨（必要なら移動/アーカイブ）:

- `mobile-app/` — Capacitor実験。バグだらけ（未定義変数`steps`, APIスキーマ不一致, 認証なし）で動作不可
- `android/` — 旧スニペット。README.mdに凍結宣言済み

```bash
rm -rf projects/health-connect-sync/mobile-app
rm -rf projects/health-connect-sync/android
```

---

## Phase 5: APK ビルド & インストール

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd projects/health-connect-sync/android-app

# Debug APK ビルド
./gradlew assembleDebug

# APK の場所
# app/build/outputs/apk/debug/app-debug.apk

# USB接続した端末にインストール (adb)
adb install app/build/outputs/apk/debug/app-debug.apk
```

起動後の確認手順:
1. アプリ起動 → "Check Health Connect" → SDK: AVAILABLE
2. "Grant Health Connect permissions" → 全権限付与
3. "Discover PC" or サーバURL手動入力 → "Save"
4. "Test" → "OK: server reachable"
5. "Sync now" → PC側 `http://localhost:8765/ui` でデータ確認

---

## 依存関係

```
Phase 1 (Gradle Wrapper + JAVA_HOME)  ← 全ての前提
    ↓
Phase 2 (Manifest修正)  ← Phase 1 完了後
    ↓
Phase 3 (セキュリティ)  ← Phase 1 と並行可能
    ↓
Phase 4 (整理)  ← いつでもOK
    ↓
Phase 5 (ビルド & 実機テスト)  ← Phase 1,2,3 完了後
```

## 環境情報

- Android SDK: `C:\Users\senta\AppData\Local\Android\Sdk`
  - platforms: android-34, android-36, android-36.1
  - build-tools: 28.0.3, 34.0.0, 35.0.0, 36.1.0
- JDK: `C:\Program Files\Android\Android Studio\jbr` (OpenJDK 21.0.9)
- Android Studio: `C:\Program Files\Android\Android Studio`
- compileSdk: 34 / minSdk: 28 / targetSdk: 34
- AGP: 8.6.1 / Kotlin: 2.0.20 / Gradle: 8.7
- Health Connect SDK: `1.2.0-alpha02`
- 端末: Android 15
