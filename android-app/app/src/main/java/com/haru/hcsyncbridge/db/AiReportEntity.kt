package com.haru.hcsyncbridge.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ai_reports")
data class AiReportEntity(
    @PrimaryKey val id: String,   // UUID
    val date: String,             // "2026-02-22"
    val reportType: String,       // "daily" | "weekly" | "monthly"
    val doctorComment: String,
    val trainerComment: String,
    val nutritionistComment: String,
    val fullText: String,         // Markdown全文
    val createdAt: Long,
)
