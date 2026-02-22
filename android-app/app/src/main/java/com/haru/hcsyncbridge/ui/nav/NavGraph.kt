package com.haru.hcsyncbridge.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.haru.hcsyncbridge.ui.ai.AiScreen
import com.haru.hcsyncbridge.ui.common.AppScaffold
import com.haru.hcsyncbridge.ui.exercise.ExerciseScreen
import com.haru.hcsyncbridge.ui.health.HealthScreen
import com.haru.hcsyncbridge.ui.home.HomeScreen
import com.haru.hcsyncbridge.ui.meal.MealScreen
import com.haru.hcsyncbridge.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Meal : Screen("meal")
    object Exercise : Screen("exercise")
    object Health : Screen("health")
    object AI : Screen("ai")
    object Settings : Screen("settings")
}

@Composable
fun HealthAiApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    AppScaffold(
        navController = navController,
        currentRoute = currentRoute,
        onSettingsClick = {
            if (currentRoute != Screen.Settings.route) {
                navController.navigate(Screen.Settings.route)
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(paddingValues)
        ) {
            composable(Screen.Home.route) { HomeScreen() }
            composable(Screen.Meal.route) { MealScreen() }
            composable(Screen.Exercise.route) { ExerciseScreen() }
            composable(Screen.Health.route) { HealthScreen() }
            composable(Screen.AI.route) { AiScreen() }
            composable(Screen.Settings.route) { SettingsScreen() }
        }
    }
}
