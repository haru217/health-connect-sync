package com.healthai.sync.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BodyFatRecord
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
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.healthai.sync.sync.SyncRecordEnvelope
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import kotlin.reflect.KClass

class HealthConnectReader(context: Context) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun getGrantedPermissions(): Set<String> {
        return client.permissionController.getGrantedPermissions()
    }

    suspend fun readRecords(rangeStart: Instant, rangeEnd: Instant): List<SyncRecordEnvelope> {
        val filter = TimeRangeFilter.between(rangeStart, rangeEnd)
        val out = mutableListOf<SyncRecordEnvelope>()

        // Existing metrics used by current dashboard/API
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
        out += readAllInRange(BodyTemperatureRecord::class, filter).map { mapBodyTemperature(it) }
        out += readAllInRange(BasalBodyTemperatureRecord::class, filter).map { mapBasalBodyTemperature(it) }
        out += readAllInRange(BasalMetabolicRateRecord::class, filter).map { mapBasalMetabolicRate(it) }
        out += readAllInRange(HeightRecord::class, filter).map { mapHeight(it) }
        out += readAllInRange(BodyFatRecord::class, filter).map { mapBodyFat(it) }

        // Additional alpha07 read records
        out += readAllInRange(StepsCadenceRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(CyclingPedalingCadenceRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(PowerRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(ElevationGainedRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(FloorsClimbedRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(WheelchairPushesRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(Vo2MaxRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(HeartRateVariabilityRmssdRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(RespiratoryRateRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(BloodGlucoseRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(LeanBodyMassRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(BodyWaterMassRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(BoneMassRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(HydrationRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(NutritionRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(IntermenstrualBleedingRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(MenstruationFlowRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(MenstruationPeriodRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(CervicalMucusRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(OvulationTestRecord::class, filter).map { mapGenericRecord(it) }
        out += readAllInRange(SexualActivityRecord::class, filter).map { mapGenericRecord(it) }

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
                "startZoneOffset" to record.startZoneOffset?.toString(),
                "endZoneOffset" to record.endZoneOffset?.toString(),
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

    private fun mapBodyTemperature(record: BodyTemperatureRecord): SyncRecordEnvelope {
        return SyncRecordEnvelope(
            type = "BodyTemperatureRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            time = record.time.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf(
                "temperature" to record.temperature.inCelsius,
                "measurementLocation" to record.measurementLocation,
            ),
        )
    }

    private fun mapBasalBodyTemperature(record: BasalBodyTemperatureRecord): SyncRecordEnvelope {
        return SyncRecordEnvelope(
            type = "BasalBodyTemperatureRecord",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            time = record.time.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = mapOf(
                "temperature" to record.temperature.inCelsius,
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

    private fun mapGenericRecord(record: Record): SyncRecordEnvelope {
        return SyncRecordEnvelope(
            type = record::class.simpleName ?: "Record",
            recordId = record.metadata.id,
            source = record.metadata.dataOrigin.packageName,
            startTime = extractInstant(record, "getStartTime")?.toString(),
            endTime = extractInstant(record, "getEndTime")?.toString(),
            time = extractInstant(record, "getTime")?.toString(),
            lastModifiedTime = record.metadata.lastModifiedTime.toString(),
            payload = toPayloadMap(record),
        )
    }

    private fun extractInstant(record: Record, getterName: String): Instant? {
        return runCatching {
            val method = record.javaClass.methods.firstOrNull {
                it.name == getterName && it.parameterCount == 0
            } ?: return@runCatching null
            method.invoke(record) as? Instant
        }.getOrNull()
    }

    private fun toPayloadMap(record: Record): Map<String, Any?> {
        val root = mutableMapOf<String, Any?>()
        val skipKeys = setOf(
            "class",
            "metadata",
            "startTime",
            "endTime",
            "time",
            "startZoneOffset",
            "endZoneOffset",
            "zoneOffset",
        )

        for (method in record.javaClass.methods) {
            if (method.parameterCount != 0) continue
            val name = getterName(method.name) ?: continue
            if (name in skipKeys) continue
            val value = runCatching { method.invoke(record) }.getOrNull()
            root[name] = normalizeValue(value, depth = 0, seen = mutableSetOf())
        }
        return root
    }

    private fun getterName(methodName: String): String? {
        return when {
            methodName.startsWith("get") && methodName.length > 3 ->
                methodName.substring(3).replaceFirstChar { it.lowercase() }
            methodName.startsWith("is") && methodName.length > 2 ->
                methodName.substring(2).replaceFirstChar { it.lowercase() }
            else -> null
        }
    }

    private fun normalizeValue(value: Any?, depth: Int, seen: MutableSet<Int>): Any? {
        if (value == null) return null
        if (depth > 4) return value.toString()

        return when (value) {
            is String, is Number, is Boolean -> value
            is Enum<*> -> value.name
            is Instant -> value.toString()
            is LocalDate -> value.toString()
            is LocalDateTime -> value.toString()
            is OffsetDateTime -> value.toString()
            is ZonedDateTime -> value.toString()
            is List<*> -> value.map { normalizeValue(it, depth + 1, seen) }
            is Set<*> -> value.map { normalizeValue(it, depth + 1, seen) }
            is Map<*, *> -> value.entries.associate { (k, v) ->
                (k?.toString() ?: "null") to normalizeValue(v, depth + 1, seen)
            }
            else -> {
                val id = System.identityHashCode(value)
                if (!seen.add(id)) {
                    return "<cycle>"
                }

                val nested = mutableMapOf<String, Any?>()
                for (method in value.javaClass.methods) {
                    if (method.parameterCount != 0) continue
                    val nestedName = getterName(method.name) ?: continue
                    if (nestedName == "class") continue
                    val nestedValue = runCatching { method.invoke(value) }.getOrNull()
                    nested[nestedName] = normalizeValue(nestedValue, depth + 1, seen)
                }
                seen.remove(id)
                nested
            }
        }
    }
}
