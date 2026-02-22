package com.haru.hcsyncbridge.api

import com.haru.hcsyncbridge.net.HttpSyncClient
import kotlinx.serialization.Serializable

@Serializable
data class HomeSummaryMetrics(
    val weight: Float? = null,
    val weightMa7Delta: Float? = null,
    val steps: Int? = null,
    val stepsAvg7d: Int? = null,
    val sleepHours: Float? = null,
    val sleepDate: String? = null,
    val calBalance: Int? = null,
    val insight: String? = null,
    val restingHr: Int? = null,
    val spo2: Float? = null
)

class ServerApiClient(private val syncClient: HttpSyncClient) {

    // Helper functions for new UI features beyond the SyncWorker
    suspend fun getHomeSummary(): Result<HomeSummaryMetrics> {
        // Implement GET /api/summary
        // Placeholder implementation for MVP
        return Result.success(
            HomeSummaryMetrics(
                weight = 53.2f, // Default friendly female weight metric example
                weightMa7Delta = -0.3f,
                steps = 6500,
                stepsAvg7d = 7200,
                sleepHours = 6.5f,
                sleepDate = "2026-02-21",
                calBalance = -50,
                insight = "良いペースで消費が進んでいます！",
                restingHr = 65,
                spo2 = 98.0f
            )
        )
    }
}
