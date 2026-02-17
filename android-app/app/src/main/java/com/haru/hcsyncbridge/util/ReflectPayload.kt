package com.haru.hcsyncbridge.util

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.lang.reflect.Modifier
import java.time.Instant

/**
 * Health Connect Recordを「生っぽいJSON」に落とすための反射ユーティリティ。
 *
 * 注意：kotlin-reflect を使わず Java Reflection で実装（ビルド依存を減らす）。
 * MVP向け（壊れたら個別対応）。
 */
object ReflectPayload {

    fun toJsonElement(value: Any?, depth: Int = 0, seen: MutableSet<Int> = mutableSetOf()): JsonElement {
        if (value == null) return JsonNull
        if (depth > 6) return JsonPrimitive(value.toString())

        // Cycle guard (identity hash)
        val id = System.identityHashCode(value)
        if (!seen.add(id)) return JsonPrimitive("<cycle>")

        return when (value) {
            is String -> JsonPrimitive(value)
            is Number -> JsonPrimitive(value)
            is Boolean -> JsonPrimitive(value)
            is Enum<*> -> JsonPrimitive(value.name)
            is Instant -> JsonPrimitive(value.toString())
            is java.time.LocalDate -> JsonPrimitive(value.toString())
            is java.time.LocalDateTime -> JsonPrimitive(value.toString())
            is java.time.ZonedDateTime -> JsonPrimitive(value.toString())
            is java.time.OffsetDateTime -> JsonPrimitive(value.toString())
            is List<*> -> JsonArray(value.map { toJsonElement(it, depth + 1, seen) })
            is Set<*> -> JsonArray(value.map { toJsonElement(it, depth + 1, seen) })
            is Map<*, *> -> {
                buildJsonObject {
                    value.forEach { (k, v) ->
                        if (k != null) put(k.toString(), toJsonElement(v, depth + 1, seen))
                    }
                }
            }
            else -> objectToJson(value, depth + 1, seen)
        }
    }

    private fun objectToJson(any: Any, depth: Int, seen: MutableSet<Int>): JsonObject {
        val cls = any.javaClass

        // Prefer public getters
        val getters = cls.methods
            .filter { m ->
                m.parameterCount == 0 &&
                    Modifier.isPublic(m.modifiers) &&
                    (m.name.startsWith("get") || m.name.startsWith("is")) &&
                    m.name != "getClass"
            }

        return buildJsonObject {
            for (m in getters) {
                try {
                    val rawName = m.name
                    val name = when {
                        rawName.startsWith("get") && rawName.length > 3 -> rawName.substring(3)
                        rawName.startsWith("is") && rawName.length > 2 -> rawName.substring(2)
                        else -> rawName
                    }.replaceFirstChar { it.lowercase() }

                    val v = m.invoke(any)
                    put(name, toJsonElement(v, depth + 1, seen))
                } catch (_: Throwable) {
                    // skip
                }
            }
        }
    }
}
