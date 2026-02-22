package com.healthai.sync.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import com.healthai.sync.AppConfig
import com.healthai.sync.data.SettingsStore
import com.healthai.sync.health.HealthConnectReader
import com.healthai.sync.net.SyncApiClient
import kotlinx.coroutines.Dispatchers
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
        )
    }

    fun sdkStatus(): Int = HealthConnectClient.sdkStatus(appContext)

    suspend fun getGrantedPermissionsSafe(): Set<String> {
        return runCatching { reader.getGrantedPermissions() }.getOrDefault(emptySet())
    }

    suspend fun syncNow(): SyncOutcome = withContext(Dispatchers.IO) {
        val apiKey = settings.getApiKey()
        if (apiKey.isBlank()) {
            val msg = "APIキーが未設定です"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        val sdkStatus = sdkStatus()
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
            val msg = when (sdkStatus) {
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "Health Connect の更新が必要です"
                else -> "Health Connect が利用できません"
            }
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        val granted = getGrantedPermissionsSafe()
        if (!granted.containsAll(requiredPermissions)) {
            val msg = "Health Connect 権限が不足しています"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.NonRetryableError(msg)
        }

        val end = Instant.now()
        val lastSyncMs = settings.getLastSyncEpochMs()
        val start = if (lastSyncMs != null && lastSyncMs > 0L) {
            Instant.ofEpochMilli(lastSyncMs).minus(Duration.ofMinutes(5))
        } else {
            end.minus(Duration.ofDays(7))
        }

        try {
            val records = reader.readRecords(start, end)
            val request = SyncRequestPayload(
                deviceId = settings.ensureDeviceId(),
                syncId = UUID.randomUUID().toString(),
                syncedAt = end.toString(),
                rangeStart = start.toString(),
                rangeEnd = end.toString(),
                records = records,
            )
            val response = client.postSync(apiKey, request)
            val message = "同期成功: ${response.upsertedCount}件 (skipped ${response.skippedCount})"
            settings.saveSyncOutcome(end.toEpochMilli(), message)
            return@withContext SyncOutcome.Success(message)
        } catch (io: IOException) {
            val msg = "通信エラー: ${io.message ?: io.javaClass.simpleName}"
            settings.setLastResult(msg)
            return@withContext SyncOutcome.RetryableError(msg)
        } catch (e: Exception) {
            val msg = e.message ?: e.toString()
            val retry = msg.contains("HTTP_5") || msg.contains("timeout", ignoreCase = true)
            settings.setLastResult("同期失敗: $msg")
            return@withContext if (retry) {
                SyncOutcome.RetryableError(msg)
            } else {
                SyncOutcome.NonRetryableError(msg)
            }
        }
    }
}
