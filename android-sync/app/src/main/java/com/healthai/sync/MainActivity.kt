package com.healthai.sync

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.healthai.sync.data.SettingsStore
import com.healthai.sync.sync.HealthSyncRunner
import com.healthai.sync.sync.SyncScheduler
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val ACTION_HEALTH_CONNECT_SETTINGS = "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"
private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Auto periodic sync is disabled. Keep manual sync only.
        SyncScheduler.cancelScheduled(applicationContext)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    HealthSyncScreen()
                }
            }
        }
    }
}

@Composable
private fun HealthSyncScreen() {
    val context = LocalContext.current
    val appContext = remember(context) { context.applicationContext }
    val settings = remember { SettingsStore(appContext) }
    val runner = remember { HealthSyncRunner(appContext, settings) }
    val scope = rememberCoroutineScope()

    val storedApiKey by settings.apiKey.collectAsState(initial = "")
    val lastSyncMs by settings.lastSyncEpochMs.collectAsState(initial = null)
    val lastResult by settings.lastResult.collectAsState(initial = "")

    var apiKeyInput by rememberSaveable { mutableStateOf("") }
    var isSyncing by remember { mutableStateOf(false) }
    var isRepairing by remember { mutableStateOf(false) }
    var transientMessage by remember { mutableStateOf("") }
    var permissionRefreshToken by remember { mutableIntStateOf(0) }

    LaunchedEffect(storedApiKey) {
        if (apiKeyInput.isBlank()) {
            apiKeyInput = storedApiKey
        }
    }

    val grantedPermissions by produceState(
        initialValue = emptySet<String>(),
        key1 = permissionRefreshToken,
    ) {
        value = runner.getGrantedPermissionsSafe()
    }

    val requiredPermissions = remember { HealthSyncRunner.requiredPermissions }
    val allPermissionsGranted = grantedPermissions.containsAll(requiredPermissions)
    val sdkStatus = remember(permissionRefreshToken) { runner.sdkStatus() }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract(),
    ) {
        permissionRefreshToken += 1
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Health Sync", style = MaterialTheme.typography.headlineSmall)
        Text("サーバーURL: ${AppConfig.SERVER_BASE_URL}", style = MaterialTheme.typography.bodySmall)

        OutlinedTextField(
            value = apiKeyInput,
            onValueChange = { apiKeyInput = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("APIキー") },
            singleLine = true,
        )

        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                scope.launch {
                    settings.setApiKey(apiKeyInput)
                    transientMessage = "APIキーを保存しました"
                }
            },
            enabled = !isSyncing && !isRepairing,
        ) {
            Text("APIキーを保存")
        }

        val sdkText = when (sdkStatus) {
            HealthConnectClient.SDK_AVAILABLE -> "Health Connect: 利用可能"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "Health Connect: 更新が必要"
            else -> "Health Connect: 利用不可"
        }
        Text(sdkText, style = MaterialTheme.typography.bodyMedium)
        Text(
            if (allPermissionsGranted) "権限: すべて付与済み" else "権限: 未付与あり",
            style = MaterialTheme.typography.bodyMedium,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                modifier = Modifier.weight(1f),
                enabled = sdkStatus == HealthConnectClient.SDK_AVAILABLE && !isSyncing && !isRepairing,
                onClick = { permissionLauncher.launch(requiredPermissions) },
            ) {
                Text("権限を設定")
            }

            Button(
                modifier = Modifier.weight(1f),
                enabled = !isSyncing && !isRepairing,
                onClick = {
                    transientMessage = openHealthConnectSettings(appContext)
                    permissionRefreshToken += 1
                },
            ) {
                Text("HC設定を開く")
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                modifier = Modifier.weight(1f),
                enabled = !isSyncing && !isRepairing,
                onClick = {
                    scope.launch {
                        isSyncing = true
                        val outcome = runner.syncNow()
                        transientMessage = outcome.message
                        isSyncing = false
                    }
                },
            ) {
                Text(if (isSyncing) "同期中..." else "今すぐ同期する")
            }

            Button(
                modifier = Modifier.weight(1f),
                enabled = !isSyncing && !isRepairing,
                onClick = {
                    scope.launch {
                        isRepairing = true
                        val outcome = runner.repairCursorFromServer()
                        transientMessage = outcome.message
                        isRepairing = false
                    }
                },
            ) {
                Text(if (isRepairing) "修復中..." else "カーソル修復")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text("最終同期: ${formatSyncTime(lastSyncMs)}", style = MaterialTheme.typography.bodyMedium)
        Text(
            "同期結果: ${if (lastResult.isBlank()) "未実行" else lastResult}",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (transientMessage.isNotBlank()) {
            Text("メッセージ: $transientMessage", style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun openHealthConnectSettings(context: Context): String {
    return try {
        context.startActivity(
            Intent(ACTION_HEALTH_CONNECT_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
        "Health Connect設定を開きました"
    } catch (_: ActivityNotFoundException) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(HEALTH_CONNECT_PACKAGE)
        if (launchIntent != null) {
            context.startActivity(
                launchIntent.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
            "Health Connectアプリを開きました"
        } else {
            "Health Connectアプリが見つかりません"
        }
    } catch (e: Exception) {
        "Health Connect設定を開けませんでした: ${e.message ?: e.javaClass.simpleName}"
    }
}

private fun formatSyncTime(epochMs: Long?): String {
    if (epochMs == null || epochMs <= 0L) return "未同期"
    val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
        .withZone(ZoneId.systemDefault())
    return formatter.format(Instant.ofEpochMilli(epochMs))
}
