from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from datetime import datetime, timedelta


class PromptGenTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_prompt.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
        import app.nutrition as nutrition_mod
        importlib.reload(nutrition_mod)
        import app.summary as summary_mod
        importlib.reload(summary_mod)
        import app.profile as profile_mod
        importlib.reload(profile_mod)
        import app.prompt_gen as prompt_gen_mod
        importlib.reload(prompt_gen_mod)

        db_mod.init_db()
        self.nutrition_mod = nutrition_mod
        self.prompt_gen_mod = prompt_gen_mod

    def tearDown(self) -> None:
        if self._old_db_path is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self._old_db_path
        self._tmp.cleanup()

    def test_build_prompt_daily_returns_string(self) -> None:
        text = self.prompt_gen_mod.build_prompt("daily")
        self.assertIsInstance(text, str)
        self.assertIn("# お願い", text)
        self.assertIn("## 1. 体重・ダイエット視点", text)

    def test_build_prompt_invalid_type_raises(self) -> None:
        with self.assertRaises(ValueError):
            self.prompt_gen_mod.build_prompt("invalid")

    def test_build_prompt_daily_includes_all_nutrients_section(self) -> None:
        # build_prompt("daily") reads yesterday's date.
        consumed_at = datetime.now().astimezone() - timedelta(days=1)
        self.nutrition_mod.log_event(
            consumed_at=consumed_at,
            alias=None,
            label="test meal",
            count=1.0,
            kcal=500.0,
            protein_g=25.0,
            fat_g=15.0,
            carbs_g=60.0,
            micros={
                "vitamin_c_mg": 100.0,
                "sodium_mg": 1200.0,
                "omega3_mg": 900.0,
            },
        )

        text = self.prompt_gen_mod.build_prompt("daily")
        self.assertIn("### 全栄養素（記録値）", text)
        self.assertIn("Vitamin C (vitamin_c_mg): 100mg", text)
        self.assertIn("Sodium (sodium_mg): 1200mg", text)
        self.assertIn("Omega-3 (EPA+DHA) (omega3_mg): 900mg", text)


if __name__ == "__main__":
    unittest.main()
