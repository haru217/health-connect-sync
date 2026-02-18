from __future__ import annotations

from typing import Optional


# NOTE:
# This is intentionally a *low-precision* estimator to avoid missing micronutrients
# for meals without nutrition labels (izakaya/individual restaurants).
# Values are heuristics and should be treated as estimates.


def _scale(d: dict[str, float], factor: float) -> dict[str, float]:
    return {k: float(v) * factor for k, v in d.items()}


# Baseline nutrient density per 1000 kcal for a "typical" mixed meal.
# (Heuristic defaults; tweak over time based on user preference.)
BASE_PER_1000_KCAL: dict[str, float] = {
    # minerals
    "sodium_mg": 1400.0,
    "potassium_mg": 1700.0,
    "calcium_mg": 250.0,
    "magnesium_mg": 120.0,
    "phosphorus_mg": 450.0,
    "iron_mg": 4.0,
    "zinc_mg": 5.0,

    # vitamins
    "vitamin_a_mcg": 350.0,
    "vitamin_c_mg": 50.0,
    "vitamin_d_mcg": 3.0,
    "vitamin_e_mg": 4.0,
    "vitamin_k_mcg": 60.0,
    "vitamin_b1_mg": 0.5,
    "vitamin_b2_mg": 0.6,
    "niacin_mg": 7.0,
    "vitamin_b6_mg": 0.7,
    "vitamin_b12_mcg": 2.0,
    "folate_mcg": 180.0,

    # other
    "dietary_fiber_g": 12.0,
}


# Keyword-based adjustments (additive after baseline scaling)
KEYWORD_BONUS: list[tuple[list[str], dict[str, float]]] = [
    # fried potatoes tend to increase sodium, potassium, vitamin C a bit
    (["ポテト", "フライドポテト"], {"sodium_mg": 200.0, "potassium_mg": 300.0, "vitamin_c_mg": 10.0, "dietary_fiber_g": 2.0}),
    # miso soup tends to be salty
    (["味噌汁", "みそ汁"], {"sodium_mg": 600.0, "potassium_mg": 120.0}),
    # fish tends to contribute vitamin D and omega-3
    (["ブリ", "魚", "焼き"], {"vitamin_d_mcg": 5.0, "omega3_mg": 300.0, "epa_mg": 80.0, "dha_mg": 120.0}),
    # beer: alcohol grams (approx)
    (["ビール"], {"alcohol_g": 20.0}),
]


def estimate_micros(
    label: str,
    *,
    kcal: Optional[float],
    protein_g: Optional[float] = None,
    fat_g: Optional[float] = None,
    carbs_g: Optional[float] = None,
) -> dict[str, float]:
    """Return an estimated micros dict.

    If kcal is missing/0, returns {}.

    The estimator is heuristic and designed to reduce *missing* micronutrients,
    not to be nutrition-label accurate.
    """

    if kcal is None or float(kcal) <= 0:
        return {}

    factor = float(kcal) / 1000.0
    out: dict[str, float] = _scale(BASE_PER_1000_KCAL, factor)

    # Keyword bonuses
    l = (label or "").strip()
    for keys, bonus in KEYWORD_BONUS:
        if any(k in l for k in keys):
            for nk, nv in bonus.items():
                out[nk] = float(out.get(nk, 0.0)) + float(nv)

    # Derive salt equivalent from sodium if present (approx)
    # salt_equivalent_g ≈ sodium_mg * 2.54 / 1000
    if "sodium_mg" in out and "salt_equivalent_g" not in out:
        out["salt_equivalent_g"] = float(out["sodium_mg"]) * 2.54 / 1000.0

    # A very rough omega3 sum if EPA/DHA present
    if ("epa_mg" in out or "dha_mg" in out) and "omega3_mg" not in out:
        out["omega3_mg"] = float(out.get("epa_mg", 0.0)) + float(out.get("dha_mg", 0.0))

    return out
