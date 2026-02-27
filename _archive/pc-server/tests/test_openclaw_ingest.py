from __future__ import annotations

import importlib
import os
import tempfile
import unittest


class OpenClawIngestTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
        import app.nutrition as nutrition_mod
        importlib.reload(nutrition_mod)
        import app.openclaw_ingest as ingest_mod
        importlib.reload(ingest_mod)

        db_mod.init_db()
        self.db_mod = db_mod
        self.ingest_mod = ingest_mod

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path
        self._tmp.cleanup()

    def test_ingest_is_idempotent_by_event_id(self) -> None:
        payload = {
            "event_id": "test:event:1",
            "local_date": "2026-02-18",
            "items": [{"alias": "protein", "count": 1}],
        }

        r1 = self.ingest_mod.ingest_openclaw_payload(payload)
        r2 = self.ingest_mod.ingest_openclaw_payload(payload)

        self.assertEqual(r1["ingested"], 1)
        self.assertEqual(r1["duplicate"], 0)
        self.assertEqual(r2["ingested"], 0)
        self.assertEqual(r2["duplicate"], 1)

        with self.db_mod.db() as conn:
            events = conn.execute("SELECT COUNT(*) AS c FROM nutrition_events").fetchone()["c"]
            ingests = conn.execute("SELECT COUNT(*) AS c FROM openclaw_ingest_events").fetchone()["c"]
        self.assertEqual(events, 1)
        self.assertEqual(ingests, 1)

    def test_intake_is_upserted_per_day(self) -> None:
        p1 = {
            "event_id": "test:event:intake:1",
            "local_date": "2026-02-18",
            "intake_kcal": 1800,
            "items": [{"alias": "protein", "count": 1}],
        }
        p2 = {
            "event_id": "test:event:intake:2",
            "local_date": "2026-02-18",
            "intake_kcal": 2000,
            "items": [{"alias": "protein", "count": 1}],
        }
        self.ingest_mod.ingest_openclaw_payload(p1)
        self.ingest_mod.ingest_openclaw_payload(p2)

        with self.db_mod.db() as conn:
            row = conn.execute(
                "SELECT intake_kcal FROM intake_calories_daily WHERE day = ?",
                ("2026-02-18",),
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(float(row["intake_kcal"]), 2000.0)

    def test_label_item_estimates_micros_when_missing(self) -> None:
        payload = {
            "event_id": "test:event:estimate:1",
            "local_date": "2026-02-18",
            "items": [
                {
                    "label": "izakaya set meal",
                    "count": 1,
                    "kcal": 800,
                    "protein_g": 25,
                    "fat_g": 30,
                    "carbs_g": 90,
                }
            ],
        }
        self.ingest_mod.ingest_openclaw_payload(payload)

        with self.db_mod.db() as conn:
            rows = conn.execute(
                """
                SELECT nutrient_key, value
                FROM nutrition_nutrients
                WHERE local_date = ?
                """,
                ("2026-02-18",),
            ).fetchall()
        totals = {str(r["nutrient_key"]): float(r["value"]) for r in rows}
        self.assertGreater(totals.get("sodium_mg", 0.0), 0.0)
        self.assertGreater(totals.get("dietary_fiber_g", 0.0), 0.0)
        self.assertGreater(totals.get("vitamin_c_mg", 0.0), 0.0)

    def test_label_item_provided_micros_override_estimate(self) -> None:
        payload = {
            "event_id": "test:event:estimate:override",
            "local_date": "2026-02-18",
            "items": [
                {
                    "label": "restaurant menu",
                    "count": 1,
                    "kcal": 600,
                    "protein_g": 20,
                    "fat_g": 25,
                    "carbs_g": 65,
                    "micros": {"sodium_mg": 10, "vitamin_c_mg": 1.5},
                }
            ],
        }
        self.ingest_mod.ingest_openclaw_payload(payload)

        with self.db_mod.db() as conn:
            sodium = conn.execute(
                """
                SELECT value FROM nutrition_nutrients
                WHERE local_date = ? AND nutrient_key = 'sodium_mg'
                """,
                ("2026-02-18",),
            ).fetchone()
            vitamin_c = conn.execute(
                """
                SELECT value FROM nutrition_nutrients
                WHERE local_date = ? AND nutrient_key = 'vitamin_c_mg'
                """,
                ("2026-02-18",),
            ).fetchone()
        self.assertIsNotNone(sodium)
        self.assertIsNotNone(vitamin_c)
        self.assertEqual(float(sodium["value"]), 10.0)
        self.assertEqual(float(vitamin_c["value"]), 1.5)

    def test_event_id_is_required(self) -> None:
        payload = {"local_date": "2026-02-18", "items": [{"alias": "protein", "count": 1}]}
        with self.assertRaises(ValueError):
            self.ingest_mod.ingest_openclaw_payload(payload)


if __name__ == "__main__":
    unittest.main()
