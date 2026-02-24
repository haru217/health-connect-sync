CREATE TABLE IF NOT EXISTS sync_runs (
  sync_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  received_at TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS health_records (
  record_key TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL,
  record_id TEXT,
  source TEXT,
  start_time TEXT,
  end_time TEXT,
  time TEXT,
  last_modified_time TEXT,
  unit TEXT,
  payload_json TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_records_type
ON health_records(type);

CREATE INDEX IF NOT EXISTS idx_health_records_start_time
ON health_records(start_time);

CREATE INDEX IF NOT EXISTS idx_health_records_time
ON health_records(time);

CREATE INDEX IF NOT EXISTS idx_health_records_ingested_at
ON health_records(ingested_at);
