CREATE TABLE IF NOT EXISTS sync_permission_snapshots (
  sync_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  required_permissions_json TEXT NOT NULL,
  granted_permissions_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_permission_snapshots_device_received
ON sync_permission_snapshots(device_id, received_at DESC);
