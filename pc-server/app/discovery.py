from __future__ import annotations

import json
import os
import socket
import threading
from dataclasses import dataclass


DISCOVERY_PORT = int(os.getenv("DISCOVERY_PORT", "8766"))
DISCOVERY_MAGIC = os.getenv("DISCOVERY_MAGIC", "HC_SYNC_DISCOVER")
HTTP_PORT = int(os.getenv("PORT", "8765"))


@dataclass
class DiscoveryInfo:
    name: str
    baseUrl: str
    port: int


def _local_ip_for_remote(remote_ip: str) -> str:
    # Determine which local IP would be used to reach remote_ip.
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((remote_ip, 1))
        return s.getsockname()[0]
    finally:
        s.close()


def start_discovery_thread() -> None:
    enabled = os.getenv("DISCOVERY_ENABLED", "true").lower() in ("1", "true", "yes", "y")
    if not enabled:
        return

    def run() -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("0.0.0.0", DISCOVERY_PORT))

            while True:
                data, addr = sock.recvfrom(2048)
                try:
                    msg = data.decode("utf-8", errors="ignore").strip()
                    if msg != DISCOVERY_MAGIC:
                        continue

                    remote_ip, remote_port = addr[0], addr[1]
                    local_ip = _local_ip_for_remote(remote_ip)

                    info = DiscoveryInfo(
                        name=socket.gethostname(),
                        baseUrl=f"http://{local_ip}:{HTTP_PORT}",
                        port=HTTP_PORT,
                    )
                    payload = json.dumps(info.__dict__, ensure_ascii=False).encode("utf-8")
                    sock.sendto(payload, (remote_ip, remote_port))
                except Exception:
                    # Best-effort discovery: ignore errors
                    continue
        finally:
            sock.close()

    t = threading.Thread(target=run, name="hc-discovery", daemon=True)
    t.start()
