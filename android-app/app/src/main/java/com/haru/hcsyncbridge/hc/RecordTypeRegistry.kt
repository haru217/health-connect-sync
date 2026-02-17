package com.haru.hcsyncbridge.hc

import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.Record
import kotlin.reflect.KClass

/**
 * "全部読む" のためのRecord type列挙。
 *
 * 重要：Health Connectに「全Recordを列挙するAPI」がないため、ここに“候補”を並べる。
 * SDK差分で存在しないRecordがあるとビルドが落ちる問題を避けるため、
 * **FQCN文字列からClass.forNameで動的ロード**して存在するものだけ使う。
 */
object RecordTypeRegistry {

    // Add more as needed. Missing ones will be ignored.
    private val recordTypeNames: List<String> = listOf(
        // Activity / movement
        "androidx.health.connect.client.records.StepsRecord",
        "androidx.health.connect.client.records.DistanceRecord",
        "androidx.health.connect.client.records.SpeedRecord",
        "androidx.health.connect.client.records.ActivityIntensityRecord",
        "androidx.health.connect.client.records.ActiveCaloriesBurnedRecord",
        "androidx.health.connect.client.records.TotalCaloriesBurnedRecord",

        // Sessions
        "androidx.health.connect.client.records.ExerciseSessionRecord",

        // Sleep
        "androidx.health.connect.client.records.SleepSessionRecord",

        // Vitals
        "androidx.health.connect.client.records.HeartRateRecord",
        "androidx.health.connect.client.records.RestingHeartRateRecord",
        "androidx.health.connect.client.records.BloodPressureRecord",
        "androidx.health.connect.client.records.OxygenSaturationRecord",
        "androidx.health.connect.client.records.SkinTemperatureRecord",
        "androidx.health.connect.client.records.BodyTemperatureRecord",
        "androidx.health.connect.client.records.RespiratoryRateRecord",
        "androidx.health.connect.client.records.BloodGlucoseRecord",

        // Body
        "androidx.health.connect.client.records.WeightRecord",
        "androidx.health.connect.client.records.HeightRecord",
        "androidx.health.connect.client.records.BodyFatRecord",
        "androidx.health.connect.client.records.LeanBodyMassRecord",
        "androidx.health.connect.client.records.BasalMetabolicRateRecord",
    )

    val recordTypes: List<KClass<out Record>> by lazy {
        recordTypeNames.mapNotNull { loadRecordKClass(it) }
    }

    val readPermissions: Set<String> by lazy {
        recordTypes.map { HealthPermission.getReadPermission(it) }.toSet()
    }

    private fun loadRecordKClass(fqcn: String): KClass<out Record>? {
        return try {
            val cls = Class.forName(fqcn)
            if (!Record::class.java.isAssignableFrom(cls)) return null
            @Suppress("UNCHECKED_CAST")
            (cls.kotlin as KClass<out Record>)
        } catch (_: Throwable) {
            null
        }
    }
}
