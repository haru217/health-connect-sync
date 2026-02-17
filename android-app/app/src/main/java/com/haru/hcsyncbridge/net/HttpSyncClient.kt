package com.haru.hcsyncbridge.net

import com.haru.hcsyncbridge.sync.SyncRequest
import com.haru.hcsyncbridge.sync.SyncResponse
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class HttpSyncClient(
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
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
}
