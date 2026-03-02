package com.healthai.sync.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import com.healthai.sync.AppConfig
import com.healthai.sync.data.SettingsStore
import com.healthai.sync.health.HealthConnectReader
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
        val requiredPermissions: Set<String> = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(SpeedRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(BloodPressureRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(BodyTemperatureRecord::class),
            HealthPermission.getReadPermission(BasalBodyTemperatureRecord::class),
            HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
            HealthPermission.getReadPermission(HeightRecord::class),
            HealthPermission.getReadPermission(BodyFatRecord::class),
        )
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

        val end = Instant.now()
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
        val start = if (effectiveLastSyncMs != null && effectiveLastSyncMs > 0L) {
            Instant.ofEpochMilli(effectiveLastSyncMs).minus(Duration.ofMinutes(5))
        } else {
            end.minus(Duration.ofDays(7))
        }

        try {
            val records = reader.readRecords(start, end)
            var upsertedTotal = 0
            var skippedTotal = 0
            var sentChunks = 0

            for (chunk in records.chunked(100)) {
                val response = postChunkWithRepair(
                    apiKey = apiKey,
                    deviceId = deviceId,
                    start = start,
                    end = end,
                    records = chunk,
                    grantedPermissions = granted,
                )
                upsertedTotal += response.upsertedCount
                skippedTotal += response.skippedCount
                sentChunks += 1
            }

            val message = "Sync complete: ${upsertedTotal} upserted (skipped ${skippedTotal}, chunks ${sentChunks})"
            settings.saveSyncOutcome(end.toEpochMilli(), message)
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

            if (records.size > 50) {
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

            if (attempt >= 2) {
                throw RuntimeException(
                    "SYNC_REPAIR_FAILED(size=${records.size}): ${e.message ?: e.javaClass.simpleName}",
                    e,
                )
            }

            val backoffMs = when (attempt) {
                0 -> 1_000L
                1 -> 2_500L
                else -> 5_000L
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
