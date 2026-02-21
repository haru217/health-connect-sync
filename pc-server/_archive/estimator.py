from __future__ import annotations

from math import isfinite
from typing import Any, Optional


# NOTE:
# This estimator intentionally prioritizes "no missing nutrients" over precision.
# Heuristic values are used for meals without nutrition labels.


def _scale(d: dict[str, float], factor: float) -> dict[str, float]:
    return {k: float(v) * factor for k, v in d.items()}


def _normalize_numeric_micros(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, float] = {}
    for k, v in raw.items():
        if isinstance(v, (int, float)):
            fv = float(v)
            if isfinite(fv):
                out[str(k)] = fv
    return out


# Baseline nutrient density per 1000 kcal for a "typical" mixed meal.
# Values are coarse defaults to reduce false "not consumed" diagnostics.
BASE_PER_1000_KCAL: dict[str, float] = {
    # macro-related
    "sugar_g": 30.0,
    "dietary_fiber_g": 12.0,

    # minerals
    "sodium_mg": 1400.0,
    "potassium_mg": 1700.0,
    "calcium_mg": 250.0,
    "magnesium_mg": 120.0,
    "phosphorus_mg": 450.0,
    "iron_mg": 4.0,
    "zinc_mg": 5.0,
    "copper_mg": 0.6,
    "selenium_mcg": 35.0,
    "chromium_mcg": 20.0,
    "manganese_mg": 1.2,
    "iodine_mcg": 90.0,
    "molybdenum_mcg": 25.0,

    # vitamins
    "vitamin_a_mcg": 350.0,
    "vitamin_b1_mg": 0.5,
    "vitamin_b2_mg": 0.6,
    "vitamin_b6_mg": 0.7,
    "vitamin_b12_mcg": 2.0,
    "niacin_mg": 7.0,
    "pantothenic_acid_mg": 2.5,
    "biotin_mcg": 20.0,
    "folate_mcg": 180.0,
    "vitamin_c_mg": 50.0,
    "vitamin_d_mcg": 3.0,
    "vitamin_e_mg": 4.0,
    "vitamin_k_mcg": 60.0,

    # lipids and others
    "epa_mg": 30.0,
    "dha_mg": 40.0,
    "omega3_mg": 180.0,
    "omega6_mg": 5000.0,
    "cholesterol_mg": 180.0,
    "saturated_fat_g": 8.0,
}


# Keyword-based adjustments (additive after baseline scaling).
KEYWORD_BONUS: list[tuple[list[str], dict[str, float]]] = [
    (["potato", "fries", "fried"], {"sodium_mg": 200.0, "potassium_mg": 300.0, "vitamin_c_mg": 10.0, "dietary_fiber_g": 2.0}),
    (["miso", "ramen", "soup"], {"sodium_mg": 600.0, "potassium_mg": 120.0}),
    (["fish", "salmon", "mackerel", "sashimi"], {"vitamin_d_mcg": 5.0, "omega3_mg": 300.0, "epa_mg": 80.0, "dha_mg": 120.0}),
    (["beer", "highball", "sake"], {"alcohol_g": 20.0}),
    (["coffee", "energy", "tea"], {"caffeine_mg": 70.0}),
]


def estimate_micros(
    label: str,
    *,
    kcal: Optional[float],
    protein_g: Optional[float] = None,
    fat_g: Optional[float] = None,
    carbs_g: Optional[float] = None,
) -> dict[str, float]:
    """Return estimated micronutrients.

    If `kcal` is missing/0, estimation is skipped and `{}` is returned.
    """

    if kcal is None or float(kcal) <= 0:
        return {}

    factor = float(kcal) / 1000.0
    out: dict[str, float] = _scale(BASE_PER_1000_KCAL, factor)

    # Use provided macros as rough anchors when available.
    if isinstance(carbs_g, (int, float)) and float(carbs_g) > 0:
        c = float(carbs_g)
        out["sugar_g"] = max(float(out.get("sugar_g", 0.0)), min(c * 0.45, c))
        out["dietary_fiber_g"] = max(float(out.get("dietary_fiber_g", 0.0)), c * 0.12)
    if isinstance(fat_g, (int, float)) and float(fat_g) > 0:
        f = float(fat_g)
        out["saturated_fat_g"] = max(float(out.get("saturated_fat_g", 0.0)), f * 0.35)

    # Keyword bonuses
    l = (label or "").strip().lower()
    for keys, bonus in KEYWORD_BONUS:
        if any(k in l for k in keys):
            for nk, nv in bonus.items():
                out[nk] = float(out.get(nk, 0.0)) + float(nv)

    # Derive salt equivalent from sodium if present (approx).
    if "sodium_mg" in out and "salt_equivalent_g" not in out:
        out["salt_equivalent_g"] = float(out["sodium_mg"]) * 2.54 / 1000.0

    # Keep omega3 coherent when EPA/DHA are present.
    if ("epa_mg" in out or "dha_mg" in out) and "omega3_mg" not in out:
        out["omega3_mg"] = float(out.get("epa_mg", 0.0)) + float(out.get("dha_mg", 0.0))

    return {k: float(v) for k, v in out.items() if isfinite(float(v)) and float(v) > 0}


def merge_micros_with_estimate(
    label: str,
    *,
    kcal: Optional[float],
    protein_g: Optional[float] = None,
    fat_g: Optional[float] = None,
    carbs_g: Optional[float] = None,
    provided_micros: Any = None,
) -> dict[str, float] | None:
    """Merge estimated and provided micros.

    Policy:
    - Estimate first to reduce missing nutrient coverage.
    - If provided micros exist, they override estimated values.
    """

    out = estimate_micros(label, kcal=kcal, protein_g=protein_g, fat_g=fat_g, carbs_g=carbs_g)
    provided = _normalize_numeric_micros(provided_micros)
    if provided:
        out.update(provided)
    return out or None