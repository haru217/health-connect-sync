package com.haru.hcsyncbridge.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

private val Context.dataStore by preferencesDataStore(name = "hc_sync_settings")

const val DEFAULT_SERVER_BASE_URL: String =
    "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev"
const val DEFAULT_API_KEY: String = "test12345"

object SettingsKeys {
    val SERVER_BASE_URL = stringPreferencesKey("server_base_url")
    val API_KEY = stringPreferencesKey("api_key")
    val DEVICE_ID = stringPreferencesKey("device_id")
    val LAST_SYNC_EPOCH_MS = longPreferencesKey("last_sync_epoch_ms")
    val LAST_ERROR = stringPreferencesKey("last_error")
}

class SettingsStore(private val context: Context) {

    val serverBaseUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.SERVER_BASE_URL]
            ?.trim()
            ?.trimEnd('/')
            ?.takeIf { it.isNotBlank() }
            ?: DEFAULT_SERVER_BASE_URL
    }
    val apiKey: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[SettingsKeys.API_KEY]
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: DEFAULT_API_KEY
    }
    val lastSyncEpochMs: Flow<Long?> = context.dataStore.data.map { it[SettingsKeys.LAST_SYNC_EPOCH_MS] }
    val lastError: Flow<String?> = context.dataStore.data.map { it[SettingsKeys.LAST_ERROR] }

    suspend fun ensureDeviceId(): String {
        var id: String? = null
        context.dataStore.edit { prefs ->
            id = prefs[SettingsKeys.DEVICE_ID]
            if (id == null) {
                id = "dev_${UUID.randomUUID()}"
                prefs[SettingsKeys.DEVICE_ID] = id!!
            }
        }
        return id!!
    }

    suspend fun setServerBaseUrl(url: String) {
        val normalized = url.trim().trimEnd('/').ifBlank { DEFAULT_SERVER_BASE_URL }
        context.dataStore.edit { it[SettingsKeys.SERVER_BASE_URL] = normalized }
    }

    suspend fun setApiKey(key: String) {
        val normalized = key.trim().ifBlank { DEFAULT_API_KEY }
        context.dataStore.edit { it[SettingsKeys.API_KEY] = normalized }
    }

    suspend fun ensureDefaults() {
        context.dataStore.edit { prefs ->
            val existingUrl = prefs[SettingsKeys.SERVER_BASE_URL]?.trim()?.trimEnd('/').orEmpty()
            if (existingUrl.isBlank()) {
                prefs[SettingsKeys.SERVER_BASE_URL] = DEFAULT_SERVER_BASE_URL
            }
            val existingKey = prefs[SettingsKeys.API_KEY]?.trim().orEmpty()
            if (existingKey.isBlank()) {
                prefs[SettingsKeys.API_KEY] = DEFAULT_API_KEY
            }
        }
    }

    suspend fun setLastSync(epochMs: Long) {
        context.dataStore.edit {
            it[SettingsKeys.LAST_SYNC_EPOCH_MS] = epochMs
            it.remove(SettingsKeys.LAST_ERROR)
        }
    }

    suspend fun setLastError(message: String) {
        context.dataStore.edit { it[SettingsKeys.LAST_ERROR] = message }
    }
}
