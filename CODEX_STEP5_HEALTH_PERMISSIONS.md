# Codex 実装指示書 — Step 5: Health Connect 取得データ拡張

対象タスク: T19拡張（Health Connect 権限・読み取りデータを全項目に拡大）

---

## 概要

現在 Health Connect から取得しているデータは歩数・体重・睡眠・心拍数の4種類のみ。
スマホの Health Connect に保存されている全データを取得できるよう拡張する。

変更対象ファイル（3ファイル）:
1. `android-sync/app/src/main/AndroidManifest.xml`
2. `android-sync/app/src/main/java/com/healthai/sync/sync/HealthSyncRunner.kt`
3. `android-sync/app/src/main/java/com/healthai/sync/health/HealthConnectReader.kt`

---

## 追加する権限・データ一覧

| 日本語名 | Permission 定数 | Record クラス |
|---|---|---|
| エクササイズ | READ_EXERCISE | ExerciseSessionRecord |
| アクティビティの強度 | READ_EXERCISE（同上、ExerciseSessionRecord に含まれる） | — |
| 活動中の消費カロリー | READ_ACTIVE_CALORIES_BURNED | ActiveCaloriesBurnedRecord |
| 距離 | READ_DISTANCE | DistanceRecord |
| 総消費カロリー | READ_TOTAL_CALORIES_BURNED | TotalCaloriesBurnedRecord |
| 速度 | READ_SPEED | SpeedRecord |
| 安静時の心拍数 | READ_RESTING_HEART_RATE | RestingHeartRateRecord |
| 血圧 | READ_BLOOD_PRESSURE | BloodPressureRecord |
| 酸素飽和度 | READ_OXYGEN_SATURATION | OxygenSaturationRecord |
| 皮膚温 | READ_SKIN_TEMPERATURE | SkinTemperatureRecord |
| 基礎代謝率 | READ_BASAL_METABOLIC_RATE | BasalMetabolicRateRecord |
| 身長 | READ_HEIGHT | HeightRecord |
| 体脂肪 | READ_BODY_FAT | BodyFatRecord |

---

## 1. AndroidManifest.xml

既存の4行の `uses-permission` の直後に以下を追加する:

```xml
<!-- アクティビティ -->
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_SPEED" />
<!-- 主な指標 -->
<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_BLOOD_PRESSURE" />
<uses-permission android:name="android.permission.health.READ_OXYGEN_SATURATION" />
<uses-permission android:name="android.permission.health.READ_SKIN_TEMPERATURE" />
<!-- 身体測定 -->
<uses-permission android:name="android.permission.health.READ_BASAL_METABOLIC_RATE" />
<uses-permission android:name="android.permission.health.READ_HEIGHT" />
<uses-permission android:name="android.permission.health.READ_BODY_FAT" />
```

---

## 2. HealthSyncRunner.kt

`requiredPermissions` の `setOf(...)` に以下を追加する:

```kotlin
companion object {
    val requiredPermissions: Set<String> = setOf(
        // 既存
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        // 追加
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(SpeedRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(BloodPressureRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(SkinTemperatureRecord::class),
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
    )
}
```

import 追加（ファイル冒頭）:
```kotlin
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.BodyFatRecord
```

---

## 3. HealthConnectReader.kt

### readRecords() メソッドに追加

既存の4行の `out +=` の後に追加:

```kotlin
out += readAllInRange(ExerciseSessionRecord::class, filter).map { mapExercise(it) }
out += readAllInRange(ActiveCaloriesBurnedRecord::class, filter).map { mapActiveCalories(it) }
out += readAllInRange(DistanceRecord::class, filter).map { mapDistance(it) }
out += readAllInRange(TotalCaloriesBurnedRecord::class, filter).map { mapTotalCalories(it) }
out += readAllInRange(SpeedRecord::class, filter).map { mapSpeed(it) }
out += readAllInRange(RestingHeartRateRecord::class, filter).map { mapRestingHeartRate(it) }
out += readAllInRange(BloodPressureRecord::class, filter).map { mapBloodPressure(it) }
out += readAllInRange(OxygenSaturationRecord::class, filter).map { mapOxygenSaturation(it) }
out += readAllInRange(SkinTemperatureRecord::class, filter).map { mapSkinTemperature(it) }
out += readAllInRange(BasalMetabolicRateRecord::class, filter).map { mapBasalMetabolicRate(it) }
out += readAllInRange(HeightRecord::class, filter).map { mapHeight(it) }
out += readAllInRange(BodyFatRecord::class, filter).map { mapBodyFat(it) }
```

### 追加する private fun（mapXxx メソッド）

```kotlin
private fun mapExercise(record: ExerciseSessionRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "ExerciseSessionRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        startTime = record.startTime.toString(),
        endTime = record.endTime.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf(
            "exerciseType" to record.exerciseType,
            "title" to record.title,
            "notes" to record.notes,
        ),
    )
}

private fun mapActiveCalories(record: ActiveCaloriesBurnedRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "ActiveCaloriesBurnedRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        startTime = record.startTime.toString(),
        endTime = record.endTime.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("energy" to record.energy.inKilocalories),
    )
}

private fun mapDistance(record: DistanceRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "DistanceRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        startTime = record.startTime.toString(),
        endTime = record.endTime.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("distance" to record.distance.inMeters),
    )
}

private fun mapTotalCalories(record: TotalCaloriesBurnedRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "TotalCaloriesBurnedRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        startTime = record.startTime.toString(),
        endTime = record.endTime.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("energy" to record.energy.inKilocalories),
    )
}

private fun mapSpeed(record: SpeedRecord): SyncRecordEnvelope {
    val samples = record.samples.map {
        mapOf(
            "time" to it.time.toString(),
            "speed" to it.speed.inMetersPerSecond,
        )
    }
    return SyncRecordEnvelope(
        type = "SpeedRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        startTime = record.startTime.toString(),
        endTime = record.endTime.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("samples" to samples),
    )
}

private fun mapRestingHeartRate(record: RestingHeartRateRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "RestingHeartRateRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("beatsPerMinute" to record.beatsPerMinute),
    )
}

private fun mapBloodPressure(record: BloodPressureRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "BloodPressureRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf(
            "systolic" to record.systolic.inMillimetersOfMercury,
            "diastolic" to record.diastolic.inMillimetersOfMercury,
        ),
    )
}

private fun mapOxygenSaturation(record: OxygenSaturationRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "OxygenSaturationRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("percentage" to record.percentage.value),
    )
}

private fun mapSkinTemperature(record: SkinTemperatureRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "SkinTemperatureRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf(
            "temperature" to record.baseline?.inCelsius,
            "measurementLocation" to record.measurementLocation,
        ),
    )
}

private fun mapBasalMetabolicRate(record: BasalMetabolicRateRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "BasalMetabolicRateRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("kcalPerDay" to record.basalMetabolicRate.inKilocaloriesPerDay),
    )
}

private fun mapHeight(record: HeightRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "HeightRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("height" to record.height.inMeters),
    )
}

private fun mapBodyFat(record: BodyFatRecord): SyncRecordEnvelope {
    return SyncRecordEnvelope(
        type = "BodyFatRecord",
        recordId = record.metadata.id,
        source = record.metadata.dataOrigin.packageName,
        time = record.time.toString(),
        lastModifiedTime = record.metadata.lastModifiedTime.toString(),
        payload = mapOf("percentage" to record.percentage.value),
    )
}
```

import 追加（ファイル冒頭）:
```kotlin
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.BodyFatRecord
```

---

## 注意事項

- `SkinTemperatureRecord` は `1.1.0-alpha07` で利用可能。フィールド名は最新公式ドキュメントで確認すること
- コンパイルエラーが出た場合は該当 Record クラスのフィールド名を
  `https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/package-summary`
  で確認して修正する
- 権限を追加したため、APK再インストール後にアプリで「権限を確認・設定」を再度タップする必要がある

---

## 完了条件

- [ ] GitHub Actions ビルド成功
- [ ] アプリで「権限を確認・設定」→ 全16項目が権限リストに表示される
- [ ] 「今すぐ同期する」→ 同期件数が増える
