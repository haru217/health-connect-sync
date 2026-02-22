from __future__ import annotations

import importlib
import os
import sys
import tempfile
import types
import unittest

from fastapi.testclient import TestClient


class MainAiEndpointsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_main_ai_endpoints.db")
        self._old_db_path = os.environ.get("DB_PATH")
        self._old_api_key = os.environ.get("API_KEY")
        os.environ["DB_PATH"] = self.db_path
        os.environ["API_KEY"] = "test-api-key"

        # app.main imports app.openclaw_ingest on module import.
        # Some local states may not include that module; provide a lightweight stub for these tests.
        self._old_openclaw_module = sys.modules.get("app.openclaw_ingest")
        stub = types.ModuleType("app.openclaw_ingest")
        stub.ingest_openclaw_payload = lambda payload: {  # type: ignore[attr-defined]
            "ok": True,
            "ingested": 1,
            "duplicate": 0,
            "eventId": str(payload.get("event_id", "stub")),
        }
        sys.modules["app.openclaw_ingest"] = stub

        import app.db as db_mod
        importlib.reload(db_mod)
        db_mod.init_db()

        import app.main as main_mod
        importlib.reload(main_mod)
        main_mod.start_discovery_thread = lambda: None  # type: ignore[assignment]

        self.client_ctx = TestClient(main_mod.app)
        self.client = self.client_ctx.__enter__()
        self.headers = {"X-Api-Key": "test-api-key"}

    def tearDown(self) -> None:
        self.client_ctx.__exit__(None, None, None)
        if self._old_openclaw_module is None:
            sys.modules.pop("app.openclaw_ingest", None)
        else:
            sys.modules["app.openclaw_ingest"] = self._old_openclaw_module

        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path

        if self._old_api_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = self._old_api_key

        self._tmp.cleanup()

    def test_profile_and_supplements_endpoints(self) -> None:
        r0 = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(r0.status_code, 200)
        self.assertEqual(r0.json(), {})

        put_payload = {
            "name": "Alex",
            "height_cm": 172.0,
            "birth_year": 1985,
            "sex": "male",
            "goal_weight_kg": 75.0,
        }
        r1 = self.client.put("/api/profile", headers=self.headers, json=put_payload)
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()["name"], "Alex")

        r2 = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["goal_weight_kg"], 75.0)

        r3 = self.client.get("/api/supplements", headers=self.headers)
        self.assertEqual(r3.status_code, 200)
        data = r3.json()
        self.assertIn("supplements", data)
        self.assertGreater(len(data["supplements"]), 0)
        aliases = {x.get("alias") for x in data["supplements"]}
        self.assertIn("protein", aliases)

    def test_prompt_endpoint(self) -> None:
        ok = self.client.get("/api/prompt?type=daily", headers=self.headers)
        self.assertEqual(ok.status_code, 200)
        body = ok.json()
        self.assertEqual(body["type"], "daily")
        self.assertIsInstance(body["prompt"], str)
        self.assertIn("## 1. 体重・ダイエット視点", body["prompt"])

        ng = self.client.get("/api/prompt?type=invalid", headers=self.headers)
        self.assertEqual(ng.status_code, 400)

    def test_reports_crud_endpoints(self) -> None:
        payload = {
            "report_date": "2026-02-21",
            "report_type": "daily",
            "prompt_used": "test prompt",
            "content": "test content",
        }
        create = self.client.post("/api/reports", headers=self.headers, json=payload)
        self.assertEqual(create.status_code, 201)
        created = create.json()
        self.assertIn("id", created)
        report_id = int(created["id"])

        list_all = self.client.get("/api/reports", headers=self.headers)
        self.assertEqual(list_all.status_code, 200)
        reports = list_all.json()["reports"]
        self.assertEqual(len(reports), 1)
        self.assertIn("preview", reports[0])

        get_one = self.client.get(f"/api/reports/{report_id}", headers=self.headers)
        self.assertEqual(get_one.status_code, 200)
        self.assertEqual(get_one.json()["content"], "test content")

        delete = self.client.delete(f"/api/reports/{report_id}", headers=self.headers)
        self.assertEqual(delete.status_code, 200)
        self.assertTrue(delete.json()["ok"])

        not_found = self.client.get(f"/api/reports/{report_id}", headers=self.headers)
        self.assertEqual(not_found.status_code, 404)

    def test_nutrients_targets_endpoint(self) -> None:
        before = self.client.get("/api/nutrients/targets", headers=self.headers)
        self.assertEqual(before.status_code, 200)
        before_data = before.json()
        self.assertIn("targets", before_data)
        self.assertGreater(len(before_data["targets"]), 0)

        self.client.put(
            "/api/profile",
            headers=self.headers,
            json={"height_cm": 172.0, "birth_year": 1985, "sex": "male"},
        )

        after = self.client.get("/api/nutrients/targets", headers=self.headers)
        self.assertEqual(after.status_code, 200)
        data = after.json()
        self.assertIn("targets", data)
        self.assertGreater(len(data["targets"]), 0)
        keys = {x.get("key") for x in data["targets"]}
        self.assertIn("energy_kcal", keys)

        bad_date = self.client.get("/api/nutrients/targets?date=2026/02/22", headers=self.headers)
        self.assertEqual(bad_date.status_code, 400)

    def test_requires_api_key(self) -> None:
        r = self.client.get("/api/profile")
        self.assertEqual(r.status_code, 401)

    def test_delete_nutrition_event_endpoint(self) -> None:
        date = "2026-02-22"
        add = self.client.post(
            "/api/nutrition/log",
            headers=self.headers,
            json={
                "label": "テスト食事",
                "consumed_at": f"{date}T12:00:00",
                "kcal": 123,
                "protein_g": 10,
            },
        )
        self.assertEqual(add.status_code, 200)

        day = self.client.get(f"/api/nutrition/day?date={date}", headers=self.headers)
        self.assertEqual(day.status_code, 200)
        events = day.json().get("events", [])
        self.assertGreaterEqual(len(events), 1)
        event_id = int(events[0]["id"])

        delete = self.client.delete(f"/api/nutrition/log/{event_id}", headers=self.headers)
        self.assertEqual(delete.status_code, 200)
        self.assertTrue(delete.json().get("ok"))

        delete_again = self.client.delete(f"/api/nutrition/log/{event_id}", headers=self.headers)
        self.assertEqual(delete_again.status_code, 404)


if __name__ == "__main__":
    unittest.main()
