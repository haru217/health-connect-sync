Ûpackage com.haru.hcsyncbridge.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [MealEntity::class, SupplLogEntity::class, AiReportEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun mealDao(): MealDao
    abstract fun supplLogDao(): SupplLogDao
    abstract fun aiReportDao(): AiReportDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "health_ai_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
Û"(80bb975014657e342d35ecf5b79a369e4c2a98df2ofile:///C:/Users/user/health-connect-sync/android-app/app/src/main/java/com/haru/hcsyncbridge/db/AppDatabase.kt:)file:///C:/Users/user/health-connect-sync