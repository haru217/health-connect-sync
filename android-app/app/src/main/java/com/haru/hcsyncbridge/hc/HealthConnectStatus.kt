package com.haru.hcsyncbridge.hc

import android.content.Context
import androidx.health.connect.client.HealthConnectClient

object HealthConnectStatus {

    enum class SdkStatus { AVAILABLE, UNAVAILABLE, UPDATE_REQUIRED, UNKNOWN }

    fun getSdkStatus(context: Context): SdkStatus {
        return try {
            when (HealthConnectClient.getSdkStatus(context)) {
                HealthConnectClient.SDK_AVAILABLE -> SdkStatus.AVAILABLE
                HealthConnectClient.SDK_UNAVAILABLE -> SdkStatus.UNAVAILABLE
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> SdkStatus.UPDATE_REQUIRED
                else -> SdkStatus.UNKNOWN
            }
        } catch (_: Throwable) {
            SdkStatus.UNKNOWN
        }
    }
}
