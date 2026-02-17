package com.haru.hcsyncbridge.sync

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class RecordEnvelope(
    val type: String,
    val recordId: String? = null,
    val recordKey: String? = null,
    val source: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val time: String? = null,
    val lastModifiedTime: String? = null,
    val unit: String? = null,
    val payload: JsonElement
)

@Serializable
data class SyncRequest(
    val deviceId: String,
    val syncId: String,
    val syncedAt: String,
    val rangeStart: String,
    val rangeEnd: String,
    val records: List<RecordEnvelope>
)

@Serializable
data class SyncResponse(
    val accepted: Boolean,
    val upsertedCount: Int,
    val skippedCount: Int
)
