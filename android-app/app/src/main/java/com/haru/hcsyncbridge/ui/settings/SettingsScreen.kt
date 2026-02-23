package com.haru.hcsyncbridge.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.haru.hcsyncbridge.net.HttpSyncClient
import com.haru.hcsyncbridge.settings.SettingsStore
import com.haru.hcsyncbridge.sync.SyncNow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val DEFAULT_SERVER_URL = "https://34.171.85.174.nip.io"
private const val DEFAULT_API_KEY = "test12345"

@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val settings = remember { SettingsStore(context) }
    val scope = rememberCoroutineScope()

    val storedUrl by settings.serverBaseUrl.collectAsState(initial = null)
    val storedKey by settings.apiKey.collectAsState(initial = null)
    val lastSyncMs by settings.lastSyncEpochMs.collectAsState(initial = null)
    val lastError by settings.lastError.collectAsState(initial = null)

    var urlInput by remember { mutableStateOf("") }
    var keyInput by remember { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf("") }

    // 初回: 保存済み値 or デフォルトを反映
    LaunchedEffect(storedUrl, storedKey) {
        if (urlInput.isBlank()) urlInput = storedUrl ?: DEFAULT_SERVER_URL
        if (keyInput.isBlank()) keyInput = storedKey ?: DEFAULT_API_KEY
    }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("設定", style = MaterialTheme.typography.titleLarge)

        Divider()

        Text("サーバー接続", style = MaterialTheme.typography.titleMedium)

        OutlinedTextField(
            value = urlInput,
            onValueChange = { urlInput = it },
            label = { Text("サーバー URL") },
            placeholder = { Text(DEFAULT_SERVER_URL) },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            singleLine = true,
        )

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
                        settings.setServerBaseUrl(urlInput.ifBlank { DEFAULT_SERVER_URL })
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
                                    urlInput.ifBlank { DEFAULT_SERVER_URL },
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

        Button(
            onClick = { SyncNow.run(context) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("今すぐ同期") }
    }
}
