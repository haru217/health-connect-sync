package com.haru.hcsyncbridge

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.haru.hcsyncbridge.sync.SyncScheduler
import com.haru.hcsyncbridge.ui.AppScreen
import com.haru.hcsyncbridge.ui.nav.HealthAiApp
import com.haru.hcsyncbridge.ui.theme.Background
import com.haru.hcsyncbridge.ui.theme.HealthAiTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Schedule daily sync (best-effort)
        SyncScheduler.scheduleDaily(this)

        setContent {
            HealthAiTheme {
                Surface(color = Background) {
                    HealthAiApp()
                }
            }
        }
    }
}
