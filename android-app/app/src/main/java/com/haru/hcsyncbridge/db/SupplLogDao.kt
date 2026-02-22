package com.haru.hcsyncbridge.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SupplLogDao {
    @Query("SELECT * FROM suppl_logs WHERE date = :date")
    fun getLogsByDate(date: String): Flow<List<SupplLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(log: SupplLogEntity)

    @Query("DELETE FROM suppl_logs WHERE id = :id")
    suspend fun deleteById(id: String)
}
