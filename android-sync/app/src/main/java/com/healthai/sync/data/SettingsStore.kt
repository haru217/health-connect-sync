package com.healthai.sync.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID

private val Context.dataStore by preferencesDataStore(name = "health_sync_settings")

private object Keys {
    val API_KEY = stringPreferencesKey("api_key")
    val DEVICE_ID = stringPreferencesKey("device_id")
    val LAST_SYNC_EPOCH_MS = longPreferencesKey("last_sync_epoch_ms")
    val LAST_RESULT = stringPreferencesKey("last_result")
}

class SettingsStore(private val context: Context) {
    val apiKey: Flow<String> = context.dataStore.data.map { it[Keys.API_KEY].orEmpty() }
    val lastSyncEpochMs: Flow<Long?> = context.dataStore.data.map { it[Keys.LAST_SYNC_EPOCH_MS] }
    val lastResult: Flow<String> = context.dataStore.data.map { it[Keys.LAST_RESULT].orEmpty() }

    suspend fun getApiKey(): String = apiKey.first().trim()

    suspend fun getLastSyncEpochMs(): Long? = lastSyncEpochMs.first()

    suspend fun setApiKey(key: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.API_KEY] = key.trim()
        }
    }

    suspend fun ensureDeviceId(): String {
        var id: String? = null
        context.dataStore.edit { prefs ->
            id = prefs[Keys.DEVICE_ID]
            if (id.isNullOrBlank()) {
                id = "android-${UUID.randomUUID()}"
                prefs[Keys.DEVICE_ID] = id!!
            }
        }
        return id!!
    }

    suspend fun saveSyncOutcome(syncEpochMs: Long, message: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.LAST_SYNC_EPOCH_MS] = syncEpochMs
            prefs[Keys.LAST_RESULT] = message
        }
    }

    suspend fun setLastResult(message: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.LAST_RESULT] = message
        }
    }
}
