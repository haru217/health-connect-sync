�package com.haru.hcsyncbridge.ui.common

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.haru.hcsyncbridge.ui.nav.Screen
import com.haru.hcsyncbridge.ui.theme.Accent
import com.haru.hcsyncbridge.ui.theme.Background
import com.haru.hcsyncbridge.ui.theme.Surface
import com.haru.hcsyncbridge.ui.theme.TextMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppScaffold(
    navController: NavHostController,
    currentRoute: String?,
    onSettingsClick: () -> Unit,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        topBar = { AppTopBar(onSettingsClick) },
        bottomBar = { AppBottomNav(navController, currentRoute) },
        containerColor = Background,
    ) { paddingValues ->
        content(paddingValues)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(onSettingsClick: () -> Unit) {
    TopAppBar(
        title = { Text("Health AI Advisor", fontWeight = FontWeight.Bold) },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = Background,
        ),
        actions = {
            IconButton(onClick = onSettingsClick) {
                Icon(Icons.Filled.Menu, contentDescription = "Settings")
            }
        }
    )
}

@Composable
fun AppBottomNav(navController: NavHostController, currentRoute: String?) {
    // Hide bottom nav on settings screen
    if (currentRoute == Screen.Settings.route) return

    NavigationBar(
        containerColor = Surface,
        contentColor = TextMuted,
        tonalElevation = 8.dp
    ) {
        val items = listOf(
            Triple(Screen.Home, "🏠", "Home"),
            Triple(Screen.Meal, "🍽", "Meal"),
            Triple(Screen.Exercise, "🏃", "Exercise"),
            Triple(Screen.Health, "❤️", "Health"),
            Triple(Screen.AI, "🤖", "AI")
        )

        items.forEach { (screen, icon, label) ->
            val selected = currentRoute == screen.route
            NavigationBarItem(
                selected = selected,
                onClick = {
                    navController.navigate(screen.route) {
                        popUpTo(Screen.Home.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { 
                    Text(text = icon, modifier = Modifier.size(24.dp))
                },
                label = { Text(label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = Accent,
                    selectedTextColor = Accent,
                    indicatorColor = Surface, // transparent indicator background if we want clean look
                    unselectedIconColor = TextMuted,
                    unselectedTextColor = TextMuted
                )
            )
        }
    }
}
�"(80bb975014657e342d35ecf5b79a369e4c2a98df2vfile:///C:/Users/user/health-connect-sync/android-app/app/src/main/java/com/haru/hcsyncbridge/ui/common/AppScaffold.kt:)file:///C:/Users/user/health-connect-sync