package com.haru.hcsyncbridge.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val AppColorScheme = lightColorScheme(
    primary = Accent,
    background = Background,
    surface = Surface,
    onPrimary = Surface,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun HealthAiTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        typography = Typography,
        content = content
    )
}
