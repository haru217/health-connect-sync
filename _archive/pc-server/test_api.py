from __future__ import annotations

import importlib
import json
import os
import sys
import types
import uuid

import pytest
from fastapi.testclient import TestClient

API_KEY = os.getenv("VITE_API_KEY", "test-key")


def auth() -> dict[str, str]:
    return {"X-Api-Key": API_KEY}


def _insert_health_record(conn, *, rec_type: str, payload: dict, start_time: str | None = None, end_time: str | None = None, time: str | None = None) -> None:
    conn.execute(
        """
        INSERT INTO health_records (
          record_key, device_id, type, start_time, end_time, time,
          payload_json, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            "test-device",
            rec_type,
            start_time,
            end_time,
            time,
            json.dumps(payload, ensure_ascii=False),
            "2026-02-25T00:00:00+09:00",
        ),
    )


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: pytest.TempPathFactory):
    db_path = str(tmp_path / "test_api.db")
    monkeypatch.setenv("DB_PATH", db_path)
    monkeypatch.setenv("API_KEY", API_KEY)

    # app.main imports app.openclaw_ingest on module import; provide a minimal stub for tests.
    stub = types.ModuleType("app.openclaw_ingest")
    stub.ingest_openclaw_payload = lambda payload: {
        "ok": True,
        "ingested": 1,
        "duplicate": 0,
        "eventId": str(payload.get("event_id", "stub")),
    }
    monkeypatch.setitem(sys.modules, "app.openclaw_ingest", stub)

    import app.db as db_mod

    importlib.reload(db_mod)
    db_mod.init_db()

    with db_mod.db() as conn:
        _insert_health_record(
            conn,
            rec_type="SleepSessionRecord",
            payload={},
            start_time="2026-02-24T22:30:00+09:00",
            end_time="2026-02-25T05:30:00+09:00",
        )
        _insert_health_record(
            conn,
            rec_type="StepsRecord",
            payload={"count": 3200},
            start_time="2026-02-25T10:00:00+09:00",
            end_time="2026-02-25T10:30:00+09:00",
        )
        _insert_health_record(
            conn,
            rec_type="WeightRecord",
            payload={"inKilograms": 72.3},
            time="2026-02-25T06:00:00+09:00",
        )
        _insert_health_record(
            conn,
            rec_type="BloodPressureRecord",
            payload={"systolic": 145, "diastolic": 92},
            time="2026-02-25T07:00:00+09:00",
        )

        conn.execute(
            """
            INSERT INTO nutrition_events (
              consumed_at, local_date, alias, label, count, kcal
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-02-25T12:00:00+09:00",
                "2026-02-25",
                "meal",
                "テスト食",
                1,
                550,
            ),
        )

        report_content = """<!--DOCTOR-->医師コメント<!--/DOCTOR-->
<!--TRAINER-->トレーナーコメント<!--/TRAINER-->
<!--NUTRITIONIST-->栄養士コメントです<!--/NUTRITIONIST-->"""
        conn.execute(
            """
            INSERT INTO ai_reports (report_date, report_type, prompt_used, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "2026-02-25",
                "daily",
                "test",
                report_content,
                "2026-02-25T08:00:00+09:00",
            ),
        )
        conn.execute(
            """
            INSERT INTO ai_reports (report_date, report_type, prompt_used, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                "2026-02-24",
                "daily",
                "test",
                "前日のレポート",
                "2026-02-24T08:00:00+09:00",
            ),
        )

    import app.main as main_mod

    importlib.reload(main_mod)
    main_mod.start_discovery_thread = lambda: None  # type: ignore[assignment]

    with TestClient(main_mod.app) as tc:
        yield tc


class TestHomeSummary:
    def test_returns_required_fields(self, client: TestClient) -> None:
        """必須フィールドが全て返ること"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "date" in body
        assert "report" in body
        assert "sufficiency" in body
        assert "statusItems" in body
        assert "attentionPoints" in body
        assert isinstance(body["statusItems"], list)
        assert isinstance(body["attentionPoints"], list)

    def test_status_items_structure(self, client: TestClient) -> None:
        """statusItems の各要素が必要なキーを持つこと"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        items = res.json()["statusItems"]
        for item in items:
            assert "key" in item
            assert "label" in item
            assert "ok" in item
            assert "tab" in item
            assert isinstance(item["ok"], bool)

    def test_attention_points_structure(self, client: TestClient) -> None:
        """attentionPoints の各要素が必要なキーを持つこと"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        points = res.json()["attentionPoints"]
        for pt in points:
            assert "id" in pt
            assert "icon" in pt
            assert "message" in pt
            assert "severity" in pt
            assert pt["severity"] in ("critical", "warning", "info", "positive")
            assert len(pt["message"]) <= 60

    def test_invalid_date_returns_400(self, client: TestClient) -> None:
        """不正な日付で 400 を返すこと"""
        res = client.get("/api/home-summary?date=not-a-date", headers=auth())
        assert res.status_code == 400

    def test_no_auth_returns_401(self, client: TestClient) -> None:
        """API キーなしで 401 を返すこと"""
        res = client.get("/api/home-summary?date=2026-02-25")
        assert res.status_code in (401, 403)

    def test_future_date_returns_empty(self, client: TestClient) -> None:
        """未来の日付でもエラーにならず空データを返すこと"""
        res = client.get("/api/home-summary?date=2099-01-01", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert body["report"] is None


class TestNutritionDay:
    def test_has_ai_comment_field(self, client: TestClient) -> None:
        """ai_comment フィールドが存在すること（null でも可）"""
        res = client.get("/api/nutrition/day?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "ai_comment" in body
        assert body["ai_comment"] is None or isinstance(body["ai_comment"], str)

    def test_extracts_nutritionist_section(self, client: TestClient) -> None:
        """栄養士セクションがあれば抽出して返すこと"""
        res = client.get("/api/nutrition/day?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        assert res.json()["ai_comment"] == "栄養士コメントです"

    def test_fallback_to_report_head_when_no_nutritionist_tag(self, client: TestClient) -> None:
        """タグがない場合はレポート本文先頭200文字を返すこと"""
        import app.db as db_mod

        raw = "A" * 260
        with db_mod.db() as conn:
            conn.execute(
                """
                INSERT INTO ai_reports (report_date, report_type, prompt_used, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("2026-02-26", "daily", "test", raw, "2026-02-26T08:00:00+09:00"),
            )

        res = client.get("/api/nutrition/day?date=2026-02-26", headers=auth())
        assert res.status_code == 200
        assert res.json()["ai_comment"] == raw[:200]


class TestConnectionStatus:
    def test_structure_and_types(self, client: TestClient) -> None:
        """connection-status が期待キーと型を返すこと"""
        res = client.get("/api/connection-status", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert set(body.keys()) == {
            "last_sync_at",
            "total_records",
            "has_weight_data",
            "has_sleep_data",
            "has_activity_data",
            "has_vitals_data",
        }
        assert body["last_sync_at"] is None or isinstance(body["last_sync_at"], str)
        assert isinstance(body["total_records"], int)
        assert isinstance(body["has_weight_data"], bool)
        assert isinstance(body["has_sleep_data"], bool)
        assert isinstance(body["has_activity_data"], bool)
        assert isinstance(body["has_vitals_data"], bool)

    def test_last_sync_at_is_populated_when_sync_runs_exist(self, client: TestClient) -> None:
        """sync_runs がある場合に last_sync_at が返ること"""
        import app.db as db_mod

        with db_mod.db() as conn:
            conn.execute(
                """
                INSERT INTO sync_runs (
                  sync_id, device_id, synced_at, range_start, range_end,
                  received_at, record_count, upserted_count, skipped_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "sync-test-1",
                    "test-device",
                    "2026-02-25T08:10:00+09:00",
                    "2026-02-24T00:00:00+09:00",
                    "2026-02-25T00:00:00+09:00",
                    "2026-02-25T08:11:00+09:00",
                    10,
                    10,
                    0,
                ),
            )

        res = client.get("/api/connection-status", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert body["last_sync_at"] == "2026-02-25T08:11:00+09:00"


class TestSleepData:
    def test_stages_fallback_to_light_when_missing(self, client: TestClient) -> None:
        """stages が無いセッションでも light_min に total が入ること"""
        res = client.get("/api/sleep-data?date=2026-02-24&period=week", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert body["current"]["sleep_minutes"] == 420
        assert body["stages"]["deep_min"] == 0
        assert body["stages"]["rem_min"] == 0
        assert body["stages"]["light_min"] == 420


class TestProfileGoals:
    def test_profile_accepts_goal_columns(self, client: TestClient) -> None:
        """profile PUT/GET で sleep_goal_minutes / steps_goal が保持されること"""
        put = client.put(
            "/api/profile",
            headers=auth(),
            json={
                "sleep_goal_minutes": 450,
                "steps_goal": 9500,
            },
        )
        assert put.status_code == 200

        get = client.get("/api/profile", headers=auth())
        assert get.status_code == 200
        body = get.json()
        assert body["sleep_goal_minutes"] == 450
        assert body["steps_goal"] == 9500

    def test_home_summary_uses_steps_goal_for_achievement(self, client: TestClient) -> None:
        """steps_goal を下げると達成判定がその値を使うこと"""
        import app.db as db_mod

        with db_mod.db() as conn:
            # goal steps を 3000 に設定
            conn.execute(
                """
                INSERT INTO user_profile(id, steps_goal, updated_at)
                VALUES(1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  steps_goal=excluded.steps_goal,
                  updated_at=excluded.updated_at
                """,
                (3000, "2026-02-25T09:00:00+09:00"),
            )

            # 2日分追加して 3日連続達成を作る（2/23, 2/24, 2/25）
            _insert_health_record(
                conn,
                rec_type="StepsRecord",
                payload={"count": 3500},
                start_time="2026-02-23T10:00:00+09:00",
                end_time="2026-02-23T10:30:00+09:00",
            )
            _insert_health_record(
                conn,
                rec_type="StepsRecord",
                payload={"count": 3600},
                start_time="2026-02-24T10:00:00+09:00",
                end_time="2026-02-24T10:30:00+09:00",
            )

        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        points = res.json().get("attentionPoints", [])
        assert any(str(p.get("id", "")).startswith("steps-achievement-") for p in points)


class TestHealthPeriodSummary:
    def test_body_data_has_period_summary(self, client: TestClient) -> None:
        res = client.get("/api/body-data?date=2026-02-25&period=week", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "periodSummary" in body
        ps = body["periodSummary"]
        assert set(ps.keys()) == {"avg_weight_kg", "avg_body_fat_pct", "avg_bmi", "points"}

    def test_vitals_data_has_period_summary(self, client: TestClient) -> None:
        res = client.get("/api/vitals-data?date=2026-02-25&period=week", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "periodSummary" in body
        ps = body["periodSummary"]
        assert set(ps.keys()) == {"avg_systolic", "avg_diastolic", "avg_resting_hr", "high_bp_points"}

    def test_sleep_data_has_spo2_period_summary(self, client: TestClient) -> None:
        res = client.get("/api/sleep-data?date=2026-02-25&period=week", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "periodSummary" in body
        ps = body["periodSummary"]
        assert "avg_spo2" in ps
        assert "min_spo2" in ps
