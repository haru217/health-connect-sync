from __future__ import annotations

import importlib
import os
import tempfile
import unittest


class ProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_profile.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
        import app.profile as profile_mod
        importlib.reload(profile_mod)

        db_mod.init_db()
        self.db_mod = db_mod
        self.profile_mod = profile_mod

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path
        self._tmp.cleanup()

    def test_get_profile_returns_none_when_empty(self) -> None:
        result = self.profile_mod.get_profile()
        self.assertIsNone(result)

    def test_upsert_creates_profile(self) -> None:
        result = self.profile_mod.upsert_profile(
            name="Test",
            height_cm=172.0,
            birth_year=1985,
            sex="male",
            goal_weight_kg=75.0,
        )
        self.assertEqual(result["name"], "Test")
        self.assertEqual(result["height_cm"], 172.0)

    def test_upsert_partial_update(self) -> None:
        self.profile_mod.upsert_profile(
            name="Initial",
            height_cm=170.0,
            birth_year=1990,
            sex="male",
            goal_weight_kg=70.0,
        )
        result = self.profile_mod.upsert_profile(goal_weight_kg=65.0)
        self.assertEqual(result["name"], "Initial")
        self.assertEqual(result["goal_weight_kg"], 65.0)

    def test_get_profile_after_upsert(self) -> None:
        self.profile_mod.upsert_profile(
            name="Check",
            height_cm=165.0,
            birth_year=1995,
            sex="female",
        )
        result = self.profile_mod.get_profile()
        self.assertIsNotNone(result)
        self.assertEqual(result["sex"], "female")


if __name__ == "__main__":
    unittest.main()
