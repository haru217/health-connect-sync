from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NutrientKey:
    key: str
    unit: str | None
    display_name: str | None = None
    category: str | None = None


# Minimal seed list. Extend as new nutrients appear.
SEED_KEYS: list[NutrientKey] = [
    NutrientKey("energy_kcal", "kcal", "Energy", "macros"),
    NutrientKey("protein_g", "g", "Protein", "macros"),
    NutrientKey("fat_g", "g", "Fat", "macros"),
    NutrientKey("carbs_g", "g", "Carbs", "macros"),
    NutrientKey("sugar_g", "g", "Sugar", "macros"),
    NutrientKey("dietary_fiber_g", "g", "Dietary fiber", "macros"),

    NutrientKey("sodium_mg", "mg", "Sodium", "minerals"),
    NutrientKey("potassium_mg", "mg", "Potassium", "minerals"),
    NutrientKey("phosphorus_mg", "mg", "Phosphorus", "minerals"),
    NutrientKey("iron_mg", "mg", "Iron", "minerals"),
    NutrientKey("manganese_mg", "mg", "Manganese", "minerals"),
    NutrientKey("iodine_mcg", "mcg", "Iodine", "minerals"),
    NutrientKey("molybdenum_mcg", "mcg", "Molybdenum", "minerals"),

    NutrientKey("vitamin_a_mcg", "mcg", "Vitamin A", "vitamins"),
    NutrientKey("vitamin_b1_mg", "mg", "Vitamin B1", "vitamins"),
    NutrientKey("vitamin_b2_mg", "mg", "Vitamin B2", "vitamins"),
    NutrientKey("vitamin_b6_mg", "mg", "Vitamin B6", "vitamins"),
    NutrientKey("vitamin_b12_mcg", "mcg", "Vitamin B12", "vitamins"),
    NutrientKey("niacin_mg", "mg", "Niacin", "vitamins"),
    NutrientKey("pantothenic_acid_mg", "mg", "Pantothenic acid", "vitamins"),
    NutrientKey("biotin_mcg", "mcg", "Biotin", "vitamins"),
    NutrientKey("folate_mcg", "mcg", "Folate", "vitamins"),
    NutrientKey("vitamin_c_mg", "mg", "Vitamin C", "vitamins"),
    NutrientKey("vitamin_d_mcg", "mcg", "Vitamin D", "vitamins"),
    NutrientKey("vitamin_e_mg", "mg", "Vitamin E", "vitamins"),
    NutrientKey("vitamin_k_mcg", "mcg", "Vitamin K", "vitamins"),
    NutrientKey("vitamin_d3_iu", "iu", "Vitamin D3", "vitamins"),
    NutrientKey("vitamin_d3_mcg", "mcg", "Vitamin D3", "vitamins"),

    NutrientKey("calcium_mg", "mg", "Calcium", "minerals"),
    NutrientKey("magnesium_mg", "mg", "Magnesium", "minerals"),
    NutrientKey("zinc_mg", "mg", "Zinc", "minerals"),
    NutrientKey("copper_mg", "mg", "Copper", "minerals"),
    NutrientKey("selenium_mcg", "mcg", "Selenium", "minerals"),
    NutrientKey("chromium_mcg", "mcg", "Chromium", "minerals"),

    NutrientKey("epa_mg", "mg", "EPA", "lipids"),
    NutrientKey("dha_mg", "mg", "DHA", "lipids"),
    NutrientKey("omega3_mg", "mg", "Omega-3 (EPA+DHA)", "lipids"),
    NutrientKey("omega6_mg", "mg", "Omega-6", "lipids"),

    NutrientKey("cholesterol_mg", "mg", "Cholesterol", "other"),
    NutrientKey("saturated_fat_g", "g", "Saturated fat", "other"),
    NutrientKey("trans_fat_g", "g", "Trans fat", "other"),
    NutrientKey("alcohol_g", "g", "Alcohol", "other"),
    NutrientKey("caffeine_mg", "mg", "Caffeine", "other"),

    NutrientKey("salt_equivalent_g", "g", "Salt equivalent", "other"),
    NutrientKey("salt_equivalent_g_max", "g", "Salt equivalent (max)", "other"),
]
