package com.haru.hcsyncbridge.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "suppl_logs")
data class SupplLogEntity(
    @PrimaryKey val id: String,  // "suppl名_date" など
    val date: String,
    val supplName: String,
    val checkedAt: Long,         // epoch ms
)
