package com.healthai.sync.sync

data class SyncRecordEnvelope(
    val type: String,
    val recordId: String? = null,
    val source: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val time: String? = null,
    val lastModifiedTime: String? = null,
    val payload: Map<String, Any?> = emptyMap(),
)

data class SyncRequestPayload(
    val deviceId: String,
    val syncId: String,
    val syncedAt: String,
    val rangeStart: String,
    val rangeEnd: String,
    val records: List<SyncRecordEnvelope>,
)

data class SyncResponsePayload(
    val accepted: Boolean,
    val upsertedCount: Int,
    val skippedCount: Int,
)

sealed class SyncOutcome(
    val message: String,
    val retryRecommended: Boolean,
) {
    class Success(message: String) : SyncOutcome(message, retryRecommended = false)
    class RetryableError(message: String) : SyncOutcome(message, retryRecommended = true)
    class NonRetryableError(message: String) : SyncOutcome(message, retryRecommended = false)
}
