package com.healthai.sync.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.healthai.sync.data.SettingsStore

class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val settings = SettingsStore(applicationContext)
        val runner = HealthSyncRunner(applicationContext, settings)
        val outcome = runner.syncNow()
        return when {
            outcome is SyncOutcome.Success -> Result.success()
            outcome.retryRecommended -> Result.retry()
            else -> Result.success()
        }
    }
}
