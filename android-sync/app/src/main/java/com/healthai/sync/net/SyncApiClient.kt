package com.healthai.sync.net

import com.healthai.sync.sync.SyncRequestPayload
import com.healthai.sync.sync.SyncResponsePayload
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SyncApiClient(
    private val baseUrl: String,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build(),
) {
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    fun postSync(apiKey: String, payload: SyncRequestPayload): SyncResponsePayload {
        val bodyText = payload.toJson().toString()
        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/sync")
            .header("X-Api-Key", apiKey)
            .post(bodyText.toRequestBody(mediaType))
            .build()

        client.newCall(request).execute().use { response ->
            val responseText = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw RuntimeException("HTTP_${response.code}: $responseText")
            }
            val json = JSONObject(responseText)
            return SyncResponsePayload(
                accepted = json.optBoolean("accepted", false),
                upsertedCount = json.optInt("upsertedCount", 0),
                skippedCount = json.optInt("skippedCount", 0),
            )
        }
    }

    private fun SyncRequestPayload.toJson(): JSONObject {
        val root = JSONObject()
        root.put("deviceId", deviceId)
        root.put("syncId", syncId)
        root.put("syncedAt", syncedAt)
        root.put("rangeStart", rangeStart)
        root.put("rangeEnd", rangeEnd)
        val recordsArray = JSONArray()
        for (r in records) {
            val obj = JSONObject()
            obj.put("type", r.type)
            r.recordId?.let { obj.put("recordId", it) }
            r.source?.let { obj.put("source", it) }
            r.startTime?.let { obj.put("startTime", it) }
            r.endTime?.let { obj.put("endTime", it) }
            r.time?.let { obj.put("time", it) }
            r.lastModifiedTime?.let { obj.put("lastModifiedTime", it) }
            obj.put("payload", mapToJson(r.payload))
            recordsArray.put(obj)
        }
        root.put("records", recordsArray)
        return root
    }

    private fun mapToJson(map: Map<String, Any?>): JSONObject {
        val obj = JSONObject()
        for ((k, v) in map) {
            obj.put(k, anyToJson(v))
        }
        return obj
    }

    private fun anyToJson(value: Any?): Any? {
        return when (value) {
            null -> JSONObject.NULL
            is Map<*, *> -> {
                val nested = JSONObject()
                for ((k, v) in value) {
                    if (k != null) {
                        nested.put(k.toString(), anyToJson(v))
                    }
                }
                nested
            }
            is List<*> -> {
                val arr = JSONArray()
                value.forEach { arr.put(anyToJson(it)) }
                arr
            }
            else -> value
        }
    }
}
