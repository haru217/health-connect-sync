from __future__ import annotations

import unittest

from app.estimator import merge_micros_with_estimate


class EstimatorTests(unittest.TestCase):
    def test_merge_returns_none_when_no_estimate_and_no_micros(self) -> None:
        out = merge_micros_with_estimate("label", kcal=None, provided_micros=None)
        self.assertIsNone(out)

    def test_merge_estimates_when_kcal_is_present(self) -> None:
        out = merge_micros_with_estimate("set meal", kcal=700, carbs_g=80, fat_g=20, provided_micros=None)
        self.assertIsNotNone(out)
        self.assertGreater(float(out.get("sodium_mg", 0.0)), 0.0)
        self.assertGreater(float(out.get("vitamin_c_mg", 0.0)), 0.0)

    def test_merge_prefers_provided_values(self) -> None:
        out = merge_micros_with_estimate(
            "restaurant meal",
            kcal=600,
            provided_micros={"sodium_mg": 10, "vitamin_c_mg": 1.25},
        )
        self.assertIsNotNone(out)
        self.assertEqual(float(out["sodium_mg"]), 10.0)
        self.assertEqual(float(out["vitamin_c_mg"]), 1.25)


if __name__ == "__main__":
    unittest.main()
