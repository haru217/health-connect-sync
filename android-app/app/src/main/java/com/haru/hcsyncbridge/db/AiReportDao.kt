package com.haru.hcsyncbridge.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AiReportDao {
    @Query("SELECT * FROM ai_reports ORDER BY createdAt DESC")
    fun getAllReports(): Flow<List<AiReportEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(report: AiReportEntity)

    @Query("DELETE FROM ai_reports WHERE id = :id")
    suspend fun deleteById(id: String)
}
