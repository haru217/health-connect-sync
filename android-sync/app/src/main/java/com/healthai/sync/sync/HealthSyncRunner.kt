package com.healthai.sync.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import com.healthai.sync.AppConfig
import com.healthai.sync.data.SettingsStore
import com.healthai.sync.health.HealthConnectReader
import com.healthai.sync.health.HealthRecordRegistry
import com.healthai.sync.net.SyncApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.IOException
import java.time.Duration
import java.time.Instant
import java.util.UUID

class HealthSyncRunner(
    context: Context,
    private val settings: SettingsStore,
    private val reader: HealthConnectReader = HealthConnectReader(context),
    private val client: SyncApiClient = SyncApiClient(AppConfig.SERVER_BASE_URL),
) {
    private val appContext = context.applicationContext

    companion object {
        val requiredPermissions: Set<String> = HealthRecordRegistry.readPermissions

        private val initialLookback: Duration = Duration.ofDays(30)
        private val overlap: Duration = Duration.ofMinutes(5)
        private val windowSize: Duration = Duration.ofDays(1)
        private const val maxWindowsPerRun: Int = 3
    }

    fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(appContext)

    suspend fun getGrantedPermissionsSafe(): Set<String> {
        return runCatching { reader.getGrantedPermissions() }.getOrDefault(emptySet())
    }

    suspend fun syncNow(): SyncOutcome = withContext(Dispatchers.IO) {
        settings.ensureDefaults()
        val apiKey = settings.getApiKey()
        if (apiKey.isBlank()) {
            val msg = "API key is not configured"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        val sdkStatus = sdkStatus()
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
            val msg = when (sdkStatus) {
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "Health Connect update required"
                else -> "Health Connect is not available"
            }
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        val granted = getGrantedPermissionsSafe()
        if (!granted.containsAll(requiredPermissions)) {
            val msg = "Health Connect permissions are not fully granted"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        try {
            val now = Instant.now()
            val deviceId = settings.ensureDeviceId()
            val localLastSyncMs = settings.getLastSyncEpochMs()
            val serverLastSyncMs = if (localLastSyncMs != null && localLastSyncMs > 0L) {
                null
            } else {
                runCatching { client.getSyncCursorEpochMs(apiKey, deviceId) }.getOrNull()
            }
            val effectiveLastSyncMs = localLastSyncMs ?: serverLastSyncMs
            if (localLastSyncMs == null && serverLastSyncMs != null && serverLastSyncMs > 0L) {
                settings.saveSyncOutcome(serverLastSyncMs, "Cursor repaired from server")
            }

            var cursor = if (effectiveLastSyncMs != null && effectiveLastSyncMs > 0L) {
                Instant.ofEpochMilli(effectiveLastSyncMs).minus(overlap)
            } else {
                now.minus(initialLookback)
            }

            if (effectiveLastSyncMs == null || effectiveLastSyncMs <= 0L) {
                val minCursor = now.minus(initialLookback)
                if (cursor.isBefore(minCursor)) {
                    cursor = minCursor
                }
            }

            var upsertedTotal = 0
            var skippedTotal = 0
            var sentChunks = 0
            var windowsDone = 0
            var lastWindowEnd: Instant? = null

            while (cursor.isBefore(now) && windowsDone < maxWindowsPerRun) {
                val windowEnd = minOf(now, cursor.plus(windowSize))
                val records = reader.readRecords(cursor, windowEnd)
                for (chunk in records.chunked(100)) {
                    val response = postChunkWithRepair(
                        apiKey = apiKey,
                        deviceId = deviceId,
                        start = cursor,
                        end = windowEnd,
                        records = chunk,
                        grantedPermissions = granted,
                    )
                    upsertedTotal += response.upsertedCount
                    skippedTotal += response.skippedCount
                    sentChunks += 1
                }

                settings.saveSyncOutcome(
                    windowEnd.toEpochMilli(),
                    "Sync progress: upserted ${upsertedTotal} (skipped ${skippedTotal}, chunks ${sentChunks}, windows ${windowsDone + 1})",
                )

                lastWindowEnd = windowEnd
                cursor = windowEnd
                windowsDone += 1
            }

            val hasRemaining = cursor.isBefore(now.minusSeconds(60))
            if (hasRemaining) {
                SyncScheduler.enqueueCatchUpNow(appContext)
            }

            val finalSyncMs = (lastWindowEnd ?: now).toEpochMilli()
            val message = buildString {
                append("Sync complete: ${upsertedTotal} upserted (skipped ${skippedTotal}, chunks ${sentChunks}, windows ${windowsDone})")
                if (hasRemaining) {
                    append(", catch-up queued")
                }
            }
            settings.saveSyncOutcome(finalSyncMs, message)
            return@withContext SyncOutcome.Success(message)
        } catch (io: IOException) {
            val msg = "Network error: ${io.message ?: io.javaClass.simpleName}"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.RetryableError(msg)
        } catch (e: Exception) {
            val msg = e.message ?: e.toString()
            val retry = isRetryableSyncError(e)
            settings.setLastResult("Sync failed: $msg")
            return@withContext if (retry) {
                SyncOutcome.RetryableError(msg)
            } else {
                SyncOutcome.NonRetryableError(msg)
            }
        }
    }

    suspend fun repairCursorFromServer(): SyncOutcome = withContext(Dispatchers.IO) {
        settings.ensureDefaults()
        val apiKey = settings.getApiKey()
        if (apiKey.isBlank()) {
            val msg = "API key is not configured"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        return@withContext try {
            val deviceId = settings.ensureDeviceId()
            val repairedMs = client.getSyncCursorEpochMs(apiKey, deviceId)
            if (repairedMs != null && repairedMs > 0L) {
                val message = "Cursor repaired: ${Instant.ofEpochMilli(repairedMs)}"
                settings.saveSyncOutcome(repairedMs, message)
                SyncOutcome.Success(message)
            } else {
                val message = "Server cursor not found (unchanged)"
                settings.setLastResult(message)
                SyncOutcome.Success(message)
            }
        } catch (io: IOException) {
            val msg = "Network error: ${io.message ?: io.javaClass.simpleName}"
            settings.setLastResult(msg)
            SyncOutcome.RetryableError(msg)
        } catch (e: Exception) {
            val msg = e.message ?: e.toString()
            val retry = isRetryableSyncError(e)
            settings.setLastResult("Cursor repair failed: $msg")
            if (retry) {
                SyncOutcome.RetryableError(msg)
            } else {
                SyncOutcome.NonRetryableError(msg)
            }
        }
    }

    private suspend fun postChunkWithRepair(
        apiKey: String,
        deviceId: String,
        start: Instant,
        end: Instant,
        records: List<SyncRecordEnvelope>,
        grantedPermissions: Set<String>,
        attempt: Int = 0,
    ): SyncResponsePayload {
        if (records.isEmpty()) {
            return SyncResponsePayload(accepted = true, upsertedCount = 0, skippedCount = 0)
        }

        val request = SyncRequestPayload(
            deviceId = deviceId,
            syncId = UUID.randomUUID().toString(),
            syncedAt = Instant.now().toString(),
            rangeStart = start.toString(),
            rangeEnd = end.toString(),
            records = records,
            requiredPermissions = requiredPermissions.toList().sorted(),
            grantedPermissions = grantedPermissions.toList().sorted(),
        )

        try {
            return client.postSync(apiKey, request)
        } catch (e: Exception) {
            if (!isRetryableSyncError(e)) {
                throw e
            }

            if (records.size > 1) {
                val mid = records.size / 2
                val left = postChunkWithRepair(
                    apiKey = apiKey,
                    deviceId = deviceId,
                    start = start,
                    end = end,
                    records = records.subList(0, mid).toList(),
                    grantedPermissions = grantedPermissions,
                )
                val right = postChunkWithRepair(
                    apiKey = apiKey,
                    deviceId = deviceId,
                    start = start,
                    end = end,
                    records = records.subList(mid, records.size).toList(),
                    grantedPermissions = grantedPermissions,
                )
                return SyncResponsePayload(
                    accepted = left.accepted && right.accepted,
                    upsertedCount = left.upsertedCount + right.upsertedCount,
                    skippedCount = left.skippedCount + right.skippedCount,
                )
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
            return postChunkWithRepair(
                apiKey = apiKey,
                deviceId = deviceId,
                start = start,
                end = end,
                records = records,
                grantedPermissions = grantedPermissions,
                attempt = attempt + 1,
            )
        }
    }

    private fun isRetryableSyncError(error: Throwable): Boolean {
        val msg = (error.message ?: "").lowercase()
        return msg.startsWith("http_503") ||
            msg.startsWith("http_429") ||
            msg.startsWith("http_520") ||
            msg.startsWith("http_522") ||
            msg.startsWith("http_524") ||
            msg.contains("timeout") ||
            msg.contains("cloudflare") ||
            msg.contains("temporarily unavailable") ||
            msg.contains("connection reset") ||
            msg.contains("broken pipe")
    }
}
