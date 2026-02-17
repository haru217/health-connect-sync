package com.haru.hcsyncbridge.net

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * PCサーバのUDP discovery。
 * - Androidが LAN ブロードキャストで "HC_SYNC_DISCOVER" を送る
 * - PCサーバが { baseUrl, name, port } をJSONで返す
 */
object ServerDiscovery {
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable
    data class DiscoveryInfo(
        val name: String? = null,
        val baseUrl: String,
        val port: Int? = null
    )

    fun discover(context: Context, timeoutMs: Int = 1500, port: Int = 8766): List<DiscoveryInfo> {
        val results = mutableListOf<DiscoveryInfo>()
        DatagramSocket().use { sock ->
            sock.broadcast = true
            sock.soTimeout = timeoutMs

            val msg = "HC_SYNC_DISCOVER".toByteArray(Charsets.UTF_8)

            // Try network-specific broadcast first
            val bcast = computeBroadcast(context)
            val targets = listOfNotNull(bcast, InetAddress.getByName("255.255.255.255")).distinct()

            for (addr in targets) {
                runCatching {
                    val packet = DatagramPacket(msg, msg.size, addr, port)
                    sock.send(packet)
                }
            }

            val buf = ByteArray(2048)
            val recv = DatagramPacket(buf, buf.size)
            val deadline = System.currentTimeMillis() + timeoutMs

            while (System.currentTimeMillis() < deadline) {
                val ok = runCatching {
                    sock.receive(recv)
                }.isSuccess
                if (!ok) break

                val text = String(recv.data, 0, recv.length, Charsets.UTF_8)
                runCatching {
                    val info = json.decodeFromString(DiscoveryInfo.serializer(), text)
                    results.add(info)
                }
            }
        }
        return results.distinctBy { it.baseUrl }
    }

    private fun computeBroadcast(context: Context): InetAddress? {
        return runCatching {
            val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val dhcp = wm.dhcpInfo ?: return null
            val ip = dhcp.ipAddress
            val mask = dhcp.netmask
            val bcast = (ip and mask) or mask.inv()
            val quads = byteArrayOf(
                (bcast and 0xff).toByte(),
                (bcast shr 8 and 0xff).toByte(),
                (bcast shr 16 and 0xff).toByte(),
                (bcast shr 24 and 0xff).toByte()
            )
            InetAddress.getByAddress(quads)
        }.getOrNull()
    }
}
