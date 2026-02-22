package com.haru.hcsyncbridge.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "meals")
data class MealEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,        // "2026-02-22"
    val timing: String,      // "breakfast" | "lunch" | "dinner" | "snack"
    val name: String,
    val kcal: Int,
    val protein: Float = 0f,
    val fat: Float = 0f,
    val carbs: Float = 0f,
)
