package com.healthai.sync.health

import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BodyWaterMassRecord
import androidx.health.connect.client.records.BoneMassRecord
import androidx.health.connect.client.records.CervicalMucusRecord
import androidx.health.connect.client.records.CyclingPedalingCadenceRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.IntermenstrualBleedingRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.MenstruationFlowRecord
import androidx.health.connect.client.records.MenstruationPeriodRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OvulationTestRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SexualActivityRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.WheelchairPushesRecord
import kotlin.reflect.KClass

object HealthRecordRegistry {
    val recordTypes: List<KClass<out Record>> = listOf(
        // Activity / movement
        StepsRecord::class,
        StepsCadenceRecord::class,
        DistanceRecord::class,
        SpeedRecord::class,
        CyclingPedalingCadenceRecord::class,
        PowerRecord::class,
        ElevationGainedRecord::class,
        FloorsClimbedRecord::class,
        WheelchairPushesRecord::class,
        ActiveCaloriesBurnedRecord::class,
        TotalCaloriesBurnedRecord::class,
        Vo2MaxRecord::class,

        // Exercise / sleep
        ExerciseSessionRecord::class,
        SleepSessionRecord::class,

        // Vitals
        HeartRateRecord::class,
        RestingHeartRateRecord::class,
        HeartRateVariabilityRmssdRecord::class,
        BloodPressureRecord::class,
        OxygenSaturationRecord::class,
        RespiratoryRateRecord::class,
        BodyTemperatureRecord::class,
        BasalBodyTemperatureRecord::class,
        BloodGlucoseRecord::class,

        // Body composition
        WeightRecord::class,
        HeightRecord::class,
        BodyFatRecord::class,
        LeanBodyMassRecord::class,
        BodyWaterMassRecord::class,
        BoneMassRecord::class,
        BasalMetabolicRateRecord::class,

        // Nutrition / hydration
        HydrationRecord::class,
        NutritionRecord::class,

        // Reproductive health
        MenstruationFlowRecord::class,
        MenstruationPeriodRecord::class,
        IntermenstrualBleedingRecord::class,
        CervicalMucusRecord::class,
        OvulationTestRecord::class,
        SexualActivityRecord::class,
    )

    val readPermissions: Set<String> by lazy {
        recordTypes.map { HealthPermission.getReadPermission(it) }.toSet()
    }
}
