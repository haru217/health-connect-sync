package com.haru.hcsyncbridge.ui.common

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

// stroke="currentColor" に相当: Icon composable の tint (LocalContentColor) で上書きされる
private fun buildNavIcon(name: String, vararg pathStrings: String): ImageVector {
    val builder = ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    )
    for (pathStr in pathStrings) {
        val nodes = PathParser().parsePathString(pathStr).toNodes()
        builder.addPath(
            pathData = nodes,
            fill = SolidColor(Color.Transparent),
            stroke = SolidColor(Color.White), // NavigationBarItem の selectedIconColor / unselectedIconColor で tint される
            strokeLineWidth = 1.5f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }
    return builder.build()
}

val NavHomeIcon: ImageVector = buildNavIcon(
    name = "NavHome",
    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M9 22L9 12L15 12L15 22",
)

val NavMealIcon: ImageVector = buildNavIcon(
    name = "NavMeal",
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
)

val NavExerciseIcon: ImageVector = buildNavIcon(
    name = "NavExercise",
    "M22 12h-4l-3 9L9 3l-3 9H2",
)

val NavHealthIcon: ImageVector = buildNavIcon(
    name = "NavHealth",
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
)

val NavAiReportIcon: ImageVector = buildNavIcon(
    name = "NavAiReport",
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2L14 8L20 8",
    "M8 16L11 12L14 15L16 11",
)
