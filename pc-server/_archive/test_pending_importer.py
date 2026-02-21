from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import import_pending


class PendingImporterTests(unittest.TestCase):
    def test_normalize_payload_generates_legacy_event_id(self) -> None:
        raw_line = json.dumps({"local_date": "2026-02-18", "items": [{"alias": "protein"}]})
        payload = import_pending._normalize_payload(
            json.loads(raw_line), "sample.jsonl", 3, raw_line
        )
        self.assertIn("event_id", payload)
        self.assertTrue(str(payload["event_id"]).startswith("legacy:sample.jsonl:3:"))
        self.assertEqual(payload["source"], "openclaw")

    def test_candidate_files_support_inbox_and_legacy_root(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            inbox = root / "inbox"
            inbox.mkdir(parents=True, exist_ok=True)

            f1 = inbox / "a.jsonl"
            f2 = root / "legacy.jsonl"
            f3 = root / "ignore.txt"
            f1.write_text("{}", encoding="utf-8")
            f2.write_text("{}", encoding="utf-8")
            f3.write_text("x", encoding="utf-8")

            files = import_pending._candidate_files(root)
            names = [p.name for p in files]
            self.assertIn("a.jsonl", names)
            self.assertIn("legacy.jsonl", names)
            self.assertNotIn("ignore.txt", names)

    def test_process_file_collects_line_errors(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "sample.jsonl"
            path.write_text(
                '{"items":[{"alias":"protein"}]}\n{"event_id":"ok:1","items":[{"alias":"protein"}]}\n',
                encoding="utf-8",
            )

            old_post = import_pending._post_json
            try:
                def fake_post_json(url: str, api_key: str, payload: dict):
                    if payload.get("event_id") == "ok:1":
                        return {"ok": True}
                    raise RuntimeError("boom")

                import_pending._post_json = fake_post_json
                errs = import_pending.process_file(
                    path,
                    endpoint="http://localhost:8765/api/openclaw/ingest",
                    api_key="x",
                )
            finally:
                import_pending._post_json = old_post

            self.assertEqual(len(errs), 1)
            self.assertTrue(errs[0].startswith("line 1:"))


if __name__ == "__main__":
    unittest.main()
