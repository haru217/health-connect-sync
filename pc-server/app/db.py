from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

# Use local timezone for day-based aggregations (JST if the PC is set to JST)
LOCAL_TZ = datetime.now().astimezone().tzinfo
from typing import Any, Iterator

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "hc_sync.db"))


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.execute(
            """
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
            """
        )
        conn.execute(
            """
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
            """
        )

        # Manual nutrition/supplement logs
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nutrition_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              consumed_at TEXT NOT NULL,
              local_date TEXT NOT NULL,
              alias TEXT,
              label TEXT NOT NULL,
              count REAL NOT NULL DEFAULT 1,
              unit TEXT,
              kcal REAL,
              protein_g REAL,
              fat_g REAL,
              carbs_g REAL,
              micros_json TEXT,
              note TEXT
            );
            """
        )

        # Normalized nutrients (preferred for graphing). Dual-write with micros_json.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nutrient_keys (
              key TEXT PRIMARY KEY,
              unit TEXT,
              display_name TEXT,
              category TEXT
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nutrition_nutrients (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id INTEGER NOT NULL,
              local_date TEXT NOT NULL,
              nutrient_key TEXT NOT NULL,
              value REAL NOT NULL,
              unit TEXT,
              FOREIGN KEY(event_id) REFERENCES nutrition_events(id)
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nutrition_nutrients_local_date ON nutrition_nutrients(local_date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nutrition_nutrients_key ON nutrition_nutrients(nutrient_key);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nutrition_nutrients_event_id ON nutrition_nutrients(event_id);")
        # Lightweight migration for older DBs
        for ddl in (
            "ALTER TABLE nutrition_events ADD COLUMN fat_g REAL;",
            "ALTER TABLE nutrition_events ADD COLUMN carbs_g REAL;",
            "ALTER TABLE nutrition_events ADD COLUMN micros_json TEXT;",
        ):
            try:
                conn.execute(ddl)
            except sqlite3.OperationalError:
                pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_nutrition_events_local_date ON nutrition_events(local_date);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nutrition_events_consumed_at ON nutrition_events(consumed_at);")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_health_records_ingested_at ON health_records(ingested_at);")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS intake_calories_daily (
              day TEXT PRIMARY KEY,
              intake_kcal REAL NOT NULL,
              source TEXT NOT NULL DEFAULT 'openclaw',
              note TEXT,
              updated_at TEXT NOT NULL
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_intake_calories_updated_at ON intake_calories_daily(updated_at);")

        # OpenClaw ingest idempotency ledger
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS openclaw_ingest_events (
              event_id TEXT PRIMARY KEY,
              ingested_at TEXT NOT NULL,
              source TEXT,
              payload_hash TEXT
            );
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_openclaw_ingest_events_ingested_at ON openclaw_ingest_events(ingested_at);")


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def dumps_payload(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
