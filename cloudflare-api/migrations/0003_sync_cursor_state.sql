CREATE TABLE IF NOT EXISTS sync_cursor_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_range_end TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_id TEXT,
  last_device_id TEXT
);

