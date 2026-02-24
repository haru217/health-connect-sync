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
import kotlinx.coroutines.delay
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
            settings.ensureDefaults()
            val baseUrl = settings.serverBaseUrl.first().trim()
            val apiKey = settings.apiKey.first().trim()
            if (baseUrl.isBlank() || apiKey.isBlank()) {
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
            val localLastMs = settings.lastSyncEpochMs.first()

            // Catch-up sync:
            // - initial lookback: 30 days
            // - per run: process at most 3 daily windows to avoid huge reads/requests
            val lookbackSeconds = 30L * 24 * 3600
            val overlapSeconds = 5L * 60L // 5 minutes overlap to avoid boundary misses
            val serverLastMs = if (localLastMs == null || localLastMs <= 0L) {
                runCatching { http.getSyncCursorEpochMs(baseUrl, apiKey, deviceId) }.getOrNull()
            } else {
                null
            }
            val effectiveLastMs = localLastMs ?: serverLastMs
            if (localLastMs == null && serverLastMs != null && serverLastMs > 0L) {
                settings.setLastSync(serverLastMs)
            }

            var cursor = if (effectiveLastMs != null && effectiveLastMs > 0L) {
                Instant.ofEpochMilli(effectiveLastMs).minusSeconds(overlapSeconds)
            } else {
                now.minusSeconds(lookbackSeconds)
            }

            // Guard: don't go too far back
            if (effectiveLastMs == null || effectiveLastMs <= 0L) {
                val minCursor = now.minusSeconds(lookbackSeconds)
                if (cursor.isBefore(minCursor)) cursor = minCursor
            }

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

        val chunkSize = 100
        val buffer = mutableListOf<RecordEnvelope>()

        suspend fun flush() {
            if (buffer.isEmpty()) return
            postChunkWithRepair(
                deviceId = deviceId,
                baseUrl = baseUrl,
                apiKey = apiKey,
                start = start,
                end = end,
                records = buffer.toList(),
            )
            buffer.clear()
        }

        for (t in RecordTypeRegistry.recordTypes) {
            val records = try {
                reader.readAllInRange(t, timeRange)
            } catch (e: SecurityException) {
                // 権限がないレコードタイプはスキップして続行
                continue
            }
            for (r in records) {
                buffer.add(toEnvelope(deviceId, r))
                if (buffer.size >= chunkSize) {
                    flush()
                }
            }
        }

        flush()
    }

    private suspend fun postChunkWithRepair(
        deviceId: String,
        baseUrl: String,
        apiKey: String,
        start: Instant,
        end: Instant,
        records: List<RecordEnvelope>,
        attempt: Int = 0,
    ) {
        if (records.isEmpty()) return
        val req = SyncRequest(
            deviceId = deviceId,
            syncId = UUID.randomUUID().toString(),
            syncedAt = toIso(Instant.now()),
            rangeStart = start.toString(),
            rangeEnd = end.toString(),
            records = records
        )
        try {
            http.postSync(baseUrl, apiKey, req)
            return
        } catch (e: Exception) {
            if (!isRetryableSyncError(e)) {
                throw e
            }

            if (records.size > 1) {
                val mid = records.size / 2
                postChunkWithRepair(
                    deviceId = deviceId,
                    baseUrl = baseUrl,
                    apiKey = apiKey,
                    start = start,
                    end = end,
                    records = records.subList(0, mid).toList(),
                )
                postChunkWithRepair(
                    deviceId = deviceId,
                    baseUrl = baseUrl,
                    apiKey = apiKey,
                    start = start,
                    end = end,
                    records = records.subList(mid, records.size).toList(),
                )
                return
            }

            if (attempt >= 4) {
                throw RuntimeException(
                    "SYNC_REPAIR_FAILED(size=${records.size}): ${e.message ?: e.javaClass.simpleName}",
                    e,
                )
            }

            val backoffMs = when (attempt) {
                0 -> 1_000L
                1 -> 2_500L
                2 -> 5_000L
                3 -> 8_000L
                else -> 12_000L
            }
            delay(backoffMs)
            postChunkWithRepair(
                deviceId = deviceId,
                baseUrl = baseUrl,
                apiKey = apiKey,
                start = start,
                end = end,
                records = records,
                attempt = attempt + 1,
            )
        }
    }

    private fun isRetryableSyncError(error: Throwable): Boolean {
        val msg = (error.message ?: "").lowercase()
        return msg.contains("http_503") ||
            msg.contains("http_429") ||
            msg.contains("1102") ||
            msg.contains("timeout") ||
            msg.contains("service unavailable") ||
            msg.contains("temporarily unavailable") ||
            msg.contains("cloudflare") ||
            msg.contains("connection reset") ||
            msg.contains("broken pipe")
    }
}
