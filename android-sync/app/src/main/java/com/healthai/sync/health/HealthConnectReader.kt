package com.healthai.sync.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.healthai.sync.sync.SyncRecordEnvelope
import java.time.Instant
import kotlin.reflect.KClass

class HealthConnectReader(context: Context) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun getGrantedPermissions(): Set<String> {
        return client.permissionController.getGrantedPermissions()
    }

    suspend fun readRecords(rangeStart: Instant, rangeEnd: Instant): List<SyncRecordEnvelope> {
        val filter = TimeRangeFilter.between(rangeStart, rangeEnd)
        val out = mutableListOf<SyncRecordEnvelope>()
        out += readAllInRange(StepsRecord::class, filter).map { mapSteps(it) }
        out += readAllInRange(WeightRecord::class, filter).map { mapWeight(it) }
        out += readAllInRange(SleepSessionRecord::class, filter).map { mapSleep(it) }
        out += readAllInRange(HeartRateRecord::class, filter).map { mapHeartRate(it) }
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
        return out
    }

    private suspend fun <T : Record> readAllInRange(
        type: KClass<T>,
        timeRange: TimeRangeFilter,
        pageSize: Int = 500,
    ): List<T> {
        val out = mutableListOf<T>()
        var pageToken: String? = null
        while (true) {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = timeRange,
                    pageSize = pageSize,
                    pageToken = pageToken,
                )
            )
            out += response.records
            pageToken = response.pageToken
            if (pageToken == null) break
        }
        return out
    }

    private fun mapSteps(record: StepsRecord): SyncRecordEnvelope {
        return SyncRecordEnvelope(
            type = "StepsRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            startTime = record.startTime.toString(),
            endTime = record.endTime.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf("count" to record.count),
        )
    }

    private fun mapWeight(record: WeightRecord): SyncRecordEnvelope {
        return SyncRecordEnvelope(
            type = "WeightRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            time = record.time.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf("kg" to record.weight.inKilograms),
        )
    }

    private fun mapSleep(record: SleepSessionRecord): SyncRecordEnvelope {
        val stages = record.stages.map {
            mapOf(
                "startTime" to it.startTime.toString(),
                "endTime" to it.endTime.toString(),
                "stage" to it.stage,
            )
        }
        return SyncRecordEnvelope(
            type = "SleepSessionRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            startTime = record.startTime.toString(),
            endTime = record.endTime.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf(
                "title" to record.title,
                "notes" to record.notes,
                "stages" to stages,
            ),
        )
    }

    private fun mapHeartRate(record: HeartRateRecord): SyncRecordEnvelope {
        val samples = record.samples.map {
            mapOf(
                "time" to it.time.toString(),
                "beatsPerMinute" to it.beatsPerMinute,
            )
        }
        return SyncRecordEnvelope(
            type = "HeartRateRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            startTime = record.startTime.toString(),
            endTime = record.endTime.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf("samples" to samples),
        )
    }

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
}
