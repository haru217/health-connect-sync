package com.haru.hcsyncbridge.hc

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.reflect.KClass

class HealthConnectReader(private val context: Context) {

    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun getGrantedPermissions(): Set<String> {
        return client.permissionController.getGrantedPermissions()
    }

    suspend fun readAllInRange(
        type: KClass<out Record>,
        timeRange: TimeRangeFilter,
        pageSize: Int = 500
    ): List<Record> = withContext(Dispatchers.IO) {
        val out = mutableListOf<Record>()
        var pageToken: String? = null

        while (true) {
            val req = ReadRecordsRequest(
                recordType = type,
                timeRangeFilter = timeRange,
                pageSize = pageSize,
                pageToken = pageToken
            )
            val resp = client.readRecords(req)
            out.addAll(resp.records)
            pageToken = resp.pageToken
            if (pageToken == null) break
        }

        out
    }
}
