from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from datetime import date


class NutrientTargetsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self._tmp.name, "test_nutrients.db")
        self._old_db_path = os.environ.get("DB_PATH")
        os.environ["DB_PATH"] = self.db_path

        import app.db as db_mod
        importlib.reload(db_mod)
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

    def test_calc_nutrient_targets_structure(self) -> None:
        rows = self.prompt_gen_mod.calc_nutrient_targets(
            height_cm=172.0,
            weight_kg=83.0,
            birth_year=1985,
            sex="male",
        )
        self.assertIsInstance(rows, list)
        self.assertGreaterEqual(len(rows), 10)
        first = rows[0]
        self.assertIn("key", first)
        self.assertIn("name", first)
        self.assertIn("unit", first)
        self.assertIn("target", first)
        self.assertIn("actual", first)
        self.assertIn("status", first)

    def test_calc_nutrient_targets_harris_benedict_energy(self) -> None:
        rows = self.prompt_gen_mod.calc_nutrient_targets(
            height_cm=172.0,
            weight_kg=83.0,
            birth_year=1985,
            sex="male",
        )
        by_key = {r["key"]: r for r in rows}
        energy = by_key["energy_kcal"]

        age = date.today().year - 1985
        bmr = 88.362 + 13.397 * 83.0 + 4.799 * 172.0 - 5.677 * age
        expected_target = round(bmr * 1.55 * 0.80, 0)
        self.assertAlmostEqual(float(energy["target"]), float(expected_target), places=1)


if __name__ == "__main__":
    unittest.main()
