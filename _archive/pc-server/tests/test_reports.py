from __future__ import annotations

import importlib
import os
import tempfile
import unittest


class ReportsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_reports.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
        import app.reports as reports_mod
        importlib.reload(reports_mod)

        db_mod.init_db()
        self.reports_mod = reports_mod

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path
        self._tmp.cleanup()

    def test_save_and_get_report(self) -> None:
        report = self.reports_mod.save_report(
            report_date="2026-02-21",
            report_type="daily",
            prompt_used="prompt",
            content="content",
        )
        self.assertIsNotNone(report.get("id"))
        loaded = self.reports_mod.get_report(int(report["id"]))
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["content"], "content")

    def test_list_reports_and_filter(self) -> None:
        self.reports_mod.save_report(
            report_date="2026-02-21",
            report_type="daily",
            prompt_used="p1",
            content="d1",
        )
        self.reports_mod.save_report(
            report_date="2026-02-21",
            report_type="weekly",
            prompt_used="p2",
            content="w1",
        )
        all_reports = self.reports_mod.list_reports()
        daily_reports = self.reports_mod.list_reports(report_type="daily")
        self.assertEqual(len(all_reports), 2)
        self.assertEqual(len(daily_reports), 1)
        self.assertEqual(daily_reports[0]["report_type"], "daily")
        self.assertIn("preview", daily_reports[0])

    def test_delete_report(self) -> None:
        report = self.reports_mod.save_report(
            report_date="2026-02-21",
            report_type="monthly",
            prompt_used="p",
            content="m1",
        )
        report_id = int(report["id"])
        deleted = self.reports_mod.delete_report(report_id)
        self.assertTrue(deleted)
        self.assertIsNone(self.reports_mod.get_report(report_id))


if __name__ == "__main__":
    unittest.main()
