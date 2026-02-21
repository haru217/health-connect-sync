from __future__ import annotations

import importlib
import os
import tempfile
import unittest


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


if __name__ == "__main__":
    unittest.main()
