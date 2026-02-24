package com.haru.hcsyncbridge.net

import com.haru.hcsyncbridge.sync.SyncRequest
import com.haru.hcsyncbridge.sync.SyncResponse
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.time.Instant
import java.util.concurrent.TimeUnit

class HttpSyncClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build(),
    private val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }
) {
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    fun postSync(serverBaseUrl: String, apiKey: String, req: SyncRequest): SyncResponse {
        val body = json.encodeToString(SyncRequest.serializer(), req).toRequestBody(mediaType)
        val request = Request.Builder()
            .url(serverBaseUrl.trimEnd('/') + "/api/sync")
            .header("X-Api-Key", apiKey)
            .post(body)
            .build()

        http.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) {
                throw RuntimeException("HTTP_${resp.code}: ${resp.body?.string()}")
            }
            val text = resp.body?.string() ?: ""
            return json.decodeFromString(SyncResponse.serializer(), text)
        }
    }

    fun getStatus(serverBaseUrl: String, apiKey: String): String {
        val request = Request.Builder()
            .url(serverBaseUrl.trimEnd('/') + "/api/status")
            .header("X-Api-Key", apiKey)
            .get()
            .build()

        http.newCall(request).execute().use { resp ->
            val body = resp.body?.string() ?: ""
            if (!resp.isSuccessful) {
                throw RuntimeException("HTTP_${resp.code}: $body")
            }
            return body
        }
    }

    fun getSyncCursorEpochMs(serverBaseUrl: String, apiKey: String, deviceId: String): Long? {
        val encodedDeviceId = URLEncoder.encode(deviceId, Charsets.UTF_8.name())
        val request = Request.Builder()
            .url(serverBaseUrl.trimEnd('/') + "/api/sync/cursor?deviceId=$encodedDeviceId")
            .header("X-Api-Key", apiKey)
            .get()
            .build()

        http.newCall(request).execute().use { resp ->
            val body = resp.body?.string() ?: ""
            if (!resp.isSuccessful) {
                throw RuntimeException("HTTP_${resp.code}: $body")
            }
            val root = json.parseToJsonElement(body).jsonObject
            val rangeEnd = root["rangeEnd"]?.jsonPrimitive?.contentOrNull ?: return null
            return runCatching { Instant.parse(rangeEnd).toEpochMilli() }.getOrNull()
        }
    }
}
