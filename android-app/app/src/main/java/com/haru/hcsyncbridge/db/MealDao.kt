package com.haru.hcsyncbridge.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MealDao {
    @Query("SELECT * FROM meals WHERE date = :date ORDER BY timing, id")
    fun getMealsByDate(date: String): Flow<List<MealEntity>>

    @Insert
    suspend fun insert(meal: MealEntity)

    @Delete
    suspend fun delete(meal: MealEntity)
}
