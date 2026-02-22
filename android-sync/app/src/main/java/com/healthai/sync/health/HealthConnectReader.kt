package com.healthai.sync.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.healthai.sync.sync.SyncRecordEnvelope
import kotlin.reflect.KClass
import java.time.Instant

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
            payload = mapOf("weight" to record.weight.inKilograms),
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
}
