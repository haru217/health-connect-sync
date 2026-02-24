package com.haru.hcsyncbridge.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.os.BuildCompat
import androidx.health.connect.client.PermissionController
import com.haru.hcsyncbridge.BuildConfig
import com.haru.hcsyncbridge.hc.RecordTypeRegistry
import com.haru.hcsyncbridge.net.HttpSyncClient
import com.haru.hcsyncbridge.settings.DEFAULT_API_KEY
import com.haru.hcsyncbridge.settings.DEFAULT_SERVER_BASE_URL
import com.haru.hcsyncbridge.settings.SettingsStore
import com.haru.hcsyncbridge.sync.SyncNow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.Instant
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val DEFAULT_SERVER_URL = DEFAULT_SERVER_BASE_URL

@OptIn(BuildCompat.PrereleaseSdkCheck::class)
@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val settings = remember { SettingsStore(context) }
    val scope = rememberCoroutineScope()

    val requestPermissions = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract()
    ) { /* 結果は lastError で確認 */ }

    val storedKey by settings.apiKey.collectAsState(initial = null)
    val lastSyncMs by settings.lastSyncEpochMs.collectAsState(initial = null)
    val lastError by settings.lastError.collectAsState(initial = null)

    var keyInput by remember { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf("") }

    // URL は常に GCP 固定。API キーのみ保存済み値 or デフォルトを反映
    LaunchedEffect(storedKey) {
        if (keyInput.isBlank()) keyInput = storedKey ?: DEFAULT_API_KEY
    }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("設定", style = MaterialTheme.typography.titleLarge)

        Text("Build: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            style = MaterialTheme.typography.bodySmall,
        )

        Divider()

        Text("サーバー接続", style = MaterialTheme.typography.titleMedium)

        OutlinedTextField(
            value = keyInput,
            onValueChange = { keyInput = it },
            label = { Text("API キー") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    scope.launch {
                        settings.setServerBaseUrl(DEFAULT_SERVER_URL)
                        settings.setApiKey(keyInput.ifBlank { DEFAULT_API_KEY })
                        statusMessage = "保存しました"
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("保存") }

            Button(
                onClick = {
                    scope.launch {
                        statusMessage = "接続確認中..."
                        try {
                            val result = withContext(Dispatchers.IO) {
                                HttpSyncClient().getStatus(
                                    DEFAULT_SERVER_URL,
                                    keyInput.ifBlank { DEFAULT_API_KEY }
                                )
                            }
                            statusMessage = "接続OK: $result"
                        } catch (e: Exception) {
                            statusMessage = "接続失敗: ${e.message}"
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("接続テスト") }
        }

        if (statusMessage.isNotBlank()) {
            Text(
                statusMessage,
                style = MaterialTheme.typography.bodySmall,
                color = if (statusMessage.startsWith("接続OK") || statusMessage.startsWith("保存"))
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.error
            )
        }

        Divider()

        Text("Health Connect 権限", style = MaterialTheme.typography.titleMedium)

        Button(
            onClick = { requestPermissions.launch(RecordTypeRegistry.readPermissions) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("権限を設定する") }

        Divider()

        Text("同期", style = MaterialTheme.typography.titleMedium)

        val lastSyncText = lastSyncMs?.let {
            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(it))
        } ?: "未同期"
        Text("最終同期: $lastSyncText", style = MaterialTheme.typography.bodyMedium)

        if (!lastError.isNullOrBlank()) {
            Text(
                "最終エラー: $lastError",
                style = MaterialTheme.typography.bodySmall,
                color = if (lastError!!.startsWith("OK"))
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.error
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { SyncNow.run(context) },
                modifier = Modifier.weight(1f)
            ) { Text("今すぐ同期") }

            Button(
                onClick = {
                    scope.launch {
                        val repairedMs = Instant.now().minus(Duration.ofMinutes(5)).toEpochMilli()
                        settings.repairSyncCursor(repairedMs)
                        statusMessage = "Sync cursor repaired"
                    }
                },
                modifier = Modifier.weight(1f)
            ) { Text("Cursor repair") }
        }
    }
}
