from __future__ import annotations

import importlib
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone


class SummarySleepBucketingTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_summary_sleep.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
        import app.summary as summary_mod
        importlib.reload(summary_mod)

        db_mod.init_db()
        self.db_mod = db_mod
        self.summary_mod = summary_mod
        self._seq = 0

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path
        self._tmp.cleanup()

    def _insert_sleep(
        self,
        *,
        start_time: str,
        end_time: str,
        payload: dict[str, object],
        source: str = "com.test.sleep",
    ) -> None:
        self._seq += 1
        with self.db_mod.db() as conn:
            conn.execute(
                """
                INSERT INTO health_records (
                  record_key, device_id, type, record_id, source,
                  start_time, end_time, time, last_modified_time, unit,
                  payload_json, ingested_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"sleep-{self._seq}",
                    "device-test",
                    "SleepSessionRecord",
                    f"rid-{self._seq}",
                    source,
                    start_time,
                    end_time,
                    None,
                    None,
                    None,
                    json.dumps(payload),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

    def _sleep_minutes_by_date(self) -> dict[str, float]:
        summary = self.summary_mod.build_summary()
        return {
            row["date"]: float(row["minutes"])
            for row in summary.get("sleepMinutesByDate", [])
            if row.get("minutes") is not None
        }

    def test_sleep_is_bucketed_to_wake_up_day_using_end_zone_offset(self) -> None:
        self._insert_sleep(
            start_time="2026-02-22T14:30:00+00:00",
            end_time="2026-02-22T22:00:00+00:00",
            payload={"endZoneOffset": "+09:00"},
        )

        by_day = self._sleep_minutes_by_date()
        self.assertIn("2026-02-23", by_day)
        self.assertAlmostEqual(by_day["2026-02-23"], 450.0)
        self.assertNotIn("2026-02-22", by_day)

    def test_sleep_with_13oclock_wake_is_kept_on_that_day(self) -> None:
        self._insert_sleep(
            start_time="2026-02-22T18:00:00+00:00",
            end_time="2026-02-23T04:00:00+00:00",
            payload={"endZoneOffset": "+09:00"},
        )

        by_day = self._sleep_minutes_by_date()
        self.assertIn("2026-02-23", by_day)
        self.assertAlmostEqual(by_day["2026-02-23"], 600.0)

    def test_sleep_falls_back_to_start_zone_offset_when_end_offset_missing(self) -> None:
        self._insert_sleep(
            start_time="2026-02-22T14:30:00+00:00",
            end_time="2026-02-22T22:00:00+00:00",
            payload={"startZoneOffset": "+09:00"},
        )

        by_day = self._sleep_minutes_by_date()
        self.assertIn("2026-02-23", by_day)
        self.assertAlmostEqual(by_day["2026-02-23"], 450.0)
        self.assertNotIn("2026-02-22", by_day)

    def test_sleep_accepts_nested_zone_offset_payload(self) -> None:
        self._insert_sleep(
            start_time="2026-02-22T14:30:00+00:00",
            end_time="2026-02-22T22:00:00+00:00",
            payload={"endZoneOffset": {"totalSeconds": 9 * 3600}},
        )

        by_day = self._sleep_minutes_by_date()
        self.assertIn("2026-02-23", by_day)
        self.assertAlmostEqual(by_day["2026-02-23"], 450.0)


if __name__ == "__main__":
    unittest.main()
