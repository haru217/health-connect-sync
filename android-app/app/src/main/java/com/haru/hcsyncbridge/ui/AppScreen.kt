package com.haru.hcsyncbridge.ui

import androidx.activity.compose.rememberLauncherForActivityResult
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
import androidx.compose.ui.unit.dp
import androidx.core.os.BuildCompat
import androidx.health.connect.client.PermissionController
import com.haru.hcsyncbridge.hc.HealthConnectStatus
import com.haru.hcsyncbridge.hc.RecordTypeRegistry
import com.haru.hcsyncbridge.net.HttpSyncClient
import com.haru.hcsyncbridge.net.ServerDiscovery
import com.haru.hcsyncbridge.settings.SettingsStore
import com.haru.hcsyncbridge.sync.SyncNow
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(BuildCompat.PrereleaseSdkCheck::class)
@Composable
fun AppScreen() {
    val context = LocalContext.current
    val settings = remember { SettingsStore(context) }

    val serverBaseUrl by settings.serverBaseUrl.collectAsState(initial = null)
    val apiKey by settings.apiKey.collectAsState(initial = null)
    val lastError by settings.lastError.collectAsState(initial = null)
    val lastSync by settings.lastSyncEpochMs.collectAsState(initial = null)

    var hcStatus by remember { mutableStateOf(HealthConnectStatus.SdkStatus.UNKNOWN) }
    var permStatus by remember { mutableStateOf("(not checked)") }
    var serverStatus by remember { mutableStateOf<String?>(null) }
    var discovered by remember { mutableStateOf<List<ServerDiscovery.DiscoveryInfo>>(emptyList()) }

    var serverUrlInput by remember { mutableStateOf(serverBaseUrl ?: "") }
    var apiKeyInput by remember { mutableStateOf(apiKey ?: "") }

    val scope = rememberCoroutineScope()

    val requestPermissions = rememberLauncherForActivityResult(
        contract = PermissionController.createRequestPermissionResultContract()
    ) { _ ->
        // We'll re-check permissions on button press
    }

    LaunchedEffect(Unit) {
        // Best-effort: when app is opened, trigger a sync if we haven't synced recently.
        // Only do this when settings are present.
        val baseUrl = settings.serverBaseUrl.first()
        val key = settings.apiKey.first()
        if (!baseUrl.isNullOrBlank() && !key.isNullOrBlank()) {
            val last = settings.lastSyncEpochMs.first()
            val now = System.currentTimeMillis()
            val stale = last == null || (now - last) > TimeUnit.HOURS.toMillis(20)
            if (stale) {
                SyncNow.run(context)
            }
        }
    }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("HC Sync Bridge (Local PC)")

        // Health Connect status
        Button(onClick = {
            scope.launch {
                hcStatus = HealthConnectStatus.getSdkStatus(context)
                permStatus = try {
                    val granted = withContext(Dispatchers.IO) {
                        val reader = com.haru.hcsyncbridge.hc.HealthConnectReader(context)
                        reader.getGrantedPermissions()
                    }
                    val need = RecordTypeRegistry.readPermissions
                    val ok = granted.containsAll(need)
                    "permissions: ${granted.size}/${need.size} (allGranted=$ok)"
                } catch (e: Exception) {
                    "permissions: error (${e.message})"
                }
            }
        }) { Text("Check Health Connect") }
        Text("HC SDK: $hcStatus")
        Text(permStatus)

        if (lastSync != null) {
            Text("Last sync: ${java.util.Date(lastSync!!)}")
        }
        if (!lastError.isNullOrBlank()) {
            Text("Last error: $lastError")
        }

        Divider()

        OutlinedTextField(
            value = serverUrlInput,
            onValueChange = { serverUrlInput = it },
            label = { Text("Server baseUrl (e.g. http://PC:8765)") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
        )

        OutlinedTextField(
            value = apiKeyInput,
            onValueChange = { apiKeyInput = it },
            label = { Text("API key (X-Api-Key)") },
            modifier = Modifier.fillMaxWidth()
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = {
                scope.launch {
                    settings.setServerBaseUrl(serverUrlInput)
                    settings.setApiKey(apiKeyInput)
                    settings.setLastError("OK: settings saved")
                }
            }) { Text("Save") }

            Button(onClick = {
                scope.launch {
                    val found = withContext(Dispatchers.IO) { ServerDiscovery.discover(context) }
                    discovered = found
                    if (found.isNotEmpty()) {
                        // don't auto-select; let user choose
                        settings.setLastError("OK: discovered ${found.size} candidate(s)")
                    } else {
                        settings.setLastError("DISCOVERY: PC not found (UDP 8766 blocked? same Wi-Fi?)")
                    }
                }
            }) { Text("Discover PC") }

            Button(onClick = {
                scope.launch {
                    try {
                        val baseUrl = serverUrlInput
                        val key = apiKeyInput
                        val status = withContext(Dispatchers.IO) {
                            HttpSyncClient().getStatus(baseUrl, key)
                        }
                        serverStatus = status
                        settings.setLastError("OK: server reachable")
                    } catch (e: Exception) {
                        serverStatus = null
                        settings.setLastError("SERVER_CHECK: ${e.message}")
                    }
                }
            }) { Text("Test") }
        }

        if (discovered.isNotEmpty()) {
            Text("Discovered PCs:")
            for (d in discovered) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Text((d.name ?: "(unknown)") + " → " + d.baseUrl, modifier = Modifier.weight(1f))
                    Button(onClick = {
                        scope.launch {
                            serverUrlInput = d.baseUrl
                            settings.setServerBaseUrl(serverUrlInput)
                            settings.setLastError("OK: selected ${d.baseUrl}")
                        }
                    }) { Text("Use") }
                }
            }
        }

        if (serverStatus != null) {
            Text("Server status: $serverStatus")
        }

        Divider()

        Button(onClick = {
            requestPermissions.launch(RecordTypeRegistry.readPermissions)
        }) { Text("Grant Health Connect permissions") }

        Button(onClick = {
            SyncNow.run(context)
        }) { Text("Sync now") }

        Divider()

        Text("Tips")
        Text("- PC server: run pc-server/run.ps1")
        Text("- If LAN access fails: run pc-server/firewall-allow.ps1 as admin")
    }
}
