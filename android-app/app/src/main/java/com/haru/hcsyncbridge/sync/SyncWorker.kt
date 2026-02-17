package com.haru.hcsyncbridge.sync

import android.content.Context
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.haru.hcsyncbridge.hc.HealthConnectReader
import com.haru.hcsyncbridge.hc.RecordTypeRegistry
import com.haru.hcsyncbridge.net.HttpSyncClient
import com.haru.hcsyncbridge.settings.SettingsStore
import com.haru.hcsyncbridge.util.ReflectPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
// import kotlinx.serialization.json.Json (unused)
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

class SyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    private val settings = SettingsStore(appContext)
    private val reader = HealthConnectReader(appContext)
    private val http = HttpSyncClient()

    private val fmt = DateTimeFormatter.ISO_OFFSET_DATE_TIME

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val baseUrl = settings.serverBaseUrl.first()?.trim()
            val apiKey = settings.apiKey.first()
            if (baseUrl.isNullOrBlank() || apiKey.isNullOrBlank()) {
                settings.setLastError("CONFIG_MISSING: serverBaseUrl or apiKey")
                return@withContext Result.retry()
            }

            // Health Connect availability
            val sdkStatus = runCatching {
                androidx.health.connect.client.HealthConnectClient.getSdkStatus(applicationContext)
            }.getOrNull()

            if (sdkStatus == androidx.health.connect.client.HealthConnectClient.SDK_UNAVAILABLE) {
                settings.setLastError("HC_UNAVAILABLE: Health Connect not available")
                return@withContext Result.retry()
            }
            if (sdkStatus == androidx.health.connect.client.HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
                settings.setLastError("HC_UPDATE_REQUIRED: Update Health Connect")
                return@withContext Result.retry()
            }

            val granted = reader.getGrantedPermissions()
            if (!granted.containsAll(RecordTypeRegistry.readPermissions)) {
                settings.setLastError("PERMISSION_MISSING: Health Connect read permissions")
                return@withContext Result.retry()
            }

            val deviceId = settings.ensureDeviceId()
            val now = Instant.now()
            val lastMs = settings.lastSyncEpochMs.first()

            // Catch-up sync:
            // - initial lookback: 90 days
            // - per run: process at most 3 daily windows to avoid huge reads/requests
            val lookbackSeconds = 90L * 24 * 3600
            val overlapSeconds = 5L * 60L // 5 minutes overlap to avoid boundary misses
            var cursor = if (lastMs != null && lastMs > 0) {
                Instant.ofEpochMilli(lastMs).minusSeconds(overlapSeconds)
            } else {
                now.minusSeconds(lookbackSeconds)
            }

            // Guard: don't go too far back
            val minCursor = now.minusSeconds(lookbackSeconds)
            if (cursor.isBefore(minCursor)) cursor = minCursor

            val windowSeconds = 24L * 3600
            val maxWindowsPerRun = 3

            var windowsDone = 0
            var lastSuccessfulEnd: Instant? = null

            while (cursor.isBefore(now) && windowsDone < maxWindowsPerRun) {
                val end = minOf(now, cursor.plusSeconds(windowSeconds))
                syncWindow(deviceId, baseUrl, apiKey, cursor, end)
                lastSuccessfulEnd = end

                cursor = end
                windowsDone += 1
            }

            if (lastSuccessfulEnd != null) {
                settings.setLastSync(lastSuccessfulEnd.toEpochMilli())
            }

            // If still behind, enqueue another catch-up run (best-effort)
            if (cursor.isBefore(now.minusSeconds(60))) {
                SyncNow.run(applicationContext)
            }

            Result.success()
        } catch (e: Exception) {
            val msg = e.message ?: e.toString()
            // Normalize common failures
            val normalized = when {
                msg.contains("UnknownHost", ignoreCase = true) -> "NETWORK: Unknown host (PC name/IP?)"
                msg.contains("ECONNREFUSED", ignoreCase = true) -> "NETWORK: Connection refused (server running? firewall?)"
                msg.contains("timeout", ignoreCase = true) -> "NETWORK: Timeout (same Wi-Fi? server reachable?)"
                msg.startsWith("HTTP_401") -> "AUTH: Invalid API key"
                msg.startsWith("HTTP_403") -> "AUTH: Forbidden"
                else -> msg
            }
            settings.setLastError(normalized)
            Result.retry()
        }
    }

    private fun toEnvelope(deviceId: String, r: Record): RecordEnvelope {
        val typeName = r::class.simpleName ?: "Record"
        val recordId = runCatching { r.metadata.id }.getOrNull()
        val source = runCatching { r.metadata.dataOrigin.packageName }.getOrNull()
        val lastModifiedTime = runCatching { r.metadata.lastModifiedTime.toString() }.getOrNull()

        val (startTime, endTime, time) = RecordTimes.extract(r)

        val payload = ReflectPayload.toJsonElement(r)

        val payloadHash = if (!recordId.isNullOrBlank()) null else sha256Hex(payload.toString())
        val recordKey = computeRecordKey(deviceId, typeName, recordId, source, startTime, endTime, time, payloadHash)

        return RecordEnvelope(
            type = typeName,
            recordId = recordId,
            recordKey = recordKey,
            source = source,
            startTime = startTime,
            endTime = endTime,
            time = time,
            lastModifiedTime = lastModifiedTime,
            payload = payload
        )
    }

    private fun toIso(i: Instant): String = fmt.format(i.atOffset(ZoneOffset.UTC))

    private fun computeRecordKey(
        deviceId: String,
        type: String,
        recordId: String?,
        source: String?,
        startTime: String?,
        endTime: String?,
        time: String?,
        payloadHash: String?
    ): String {
        // Prefer stable key based on recordId if present.
        val basis = if (!recordId.isNullOrBlank()) {
            "v1|$deviceId|$type|$recordId|${source ?: ""}"
        } else {
            // Fallback: include time fields + payload hash to reduce collisions
            "v1|$deviceId|$type|${startTime ?: ""}|${endTime ?: ""}|${time ?: ""}|${source ?: ""}|${payloadHash ?: ""}"
        }
        return sha256Hex(basis)
    }

    private fun sha256Hex(s: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    private object RecordTimes {
        private fun getInstant(r: Record, methodNames: List<String>): Instant? {
            for (name in methodNames) {
                try {
                    val m = r.javaClass.methods.firstOrNull { it.name == name && it.parameterCount == 0 }
                    if (m != null) {
                        val v = m.invoke(r)
                        if (v is Instant) return v
                    }
                } catch (_: Throwable) {
                    // ignore
                }
            }
            return null
        }

        fun extract(r: Record): Triple<String?, String?, String?> {
            val st = getInstant(r, listOf("getStartTime", "startTime"))
            val et = getInstant(r, listOf("getEndTime", "endTime"))
            val t = getInstant(r, listOf("getTime", "time"))
            return Triple(st?.toString(), et?.toString(), t?.toString())
        }
    }

    private suspend fun syncWindow(
        deviceId: String,
        baseUrl: String,
        apiKey: String,
        start: Instant,
        end: Instant
    ) {
        val timeRange = TimeRangeFilter.between(start, end)

        val chunkSize = 200
        val buffer = mutableListOf<RecordEnvelope>()

        fun flush() {
            if (buffer.isEmpty()) return
            val req = SyncRequest(
                deviceId = deviceId,
                syncId = UUID.randomUUID().toString(),
                syncedAt = toIso(Instant.now()),
                rangeStart = start.toString(),
                rangeEnd = end.toString(),
                records = buffer.toList()
            )
            http.postSync(baseUrl, apiKey, req)
            buffer.clear()
        }

        for (t in RecordTypeRegistry.recordTypes) {
            val records = reader.readAllInRange(t, timeRange)
            for (r in records) {
                buffer.add(toEnvelope(deviceId, r))
                if (buffer.size >= chunkSize) {
                    flush()
                }
            }
        }

        flush()
    }
}
