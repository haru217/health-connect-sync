from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import json

from .db import LOCAL_TZ, db
from .nutrient_keys import SEED_KEYS


@dataclass
class CatalogItem:
    alias: str
    label: str
    kcal: float | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    carbs_g: float | None = None
    micros: dict[str, float] | None = None
    unit: str | None = None


# User-defined aliases (initial)
# NOTE: kcal/protein can be filled later when label is confirmed.
CATALOG: dict[str, CatalogItem] = {
    "protein": CatalogItem(
        alias="protein",
        label="ザバス ミルクプロテイン 脂肪0 キャラメル風味 200ml",
        kcal=107.0,
        protein_g=20.0,
        fat_g=0.0,
        carbs_g=6.8,
        unit="1本",
    ),
    "vitamin_d": CatalogItem(
        alias="vitamin_d",
        label="ビタミンD3 2000IU（ソフトジェル）",
        kcal=0.0,
        protein_g=0.0,
        fat_g=0.0,
        carbs_g=0.0,
        micros={"vitamin_d3_iu": 2000.0, "vitamin_d3_mcg": 50.0},
        unit="1錠",
    ),
    "multivitamin": CatalogItem(
        alias="multivitamin",
        label="スーパーマルチビタミン＆ミネラル",
        kcal=3.36,
        protein_g=0.1,
        fat_g=0.1,
        carbs_g=0.656,
        micros={
            "calcium_mg": 200.0,
            "magnesium_mg": 100.0,
            "zinc_mg": 6.0,
            "copper_mg": 0.6,
            "selenium_mcg": 50.0,
            "chromium_mcg": 20.0,
            "vitamin_a_mcg": 1200.0,
            "vitamin_b1_mg": 1.5,
            "vitamin_b2_mg": 1.7,
            "vitamin_b6_mg": 2.0,
            "vitamin_b12_mcg": 3.0,
            "niacin_mg": 15.0,
            "pantothenic_acid_mg": 6.0,
            "biotin_mcg": 50.0,
            "folate_mcg": 240.0,
            "vitamin_c_mg": 125.0,
            "vitamin_d_mcg": 10.0,
            "vitamin_e_mg": 9.0,
            "salt_equivalent_g_max": 0.01,
        },
        unit="1錠",
    ),
    "fish_oil": CatalogItem(
        alias="fish_oil",
        label="スーパーフィッシュオイル",
        kcal=8.34,
        protein_g=0.222,
        fat_g=0.791,
        carbs_g=0.1,
        micros={
            "epa_mg": 190.0,
            "dha_mg": 80.0,
            "omega3_mg": 270.0,
            "salt_equivalent_g_max": 0.01,
        },
        unit="1粒",
    ),
}


def local_date_of(dt: datetime) -> str:
    return dt.astimezone(LOCAL_TZ).date().isoformat()


def _seed_nutrient_keys(conn) -> None:
    for nk in SEED_KEYS:
        conn.execute(
            """
            INSERT OR IGNORE INTO nutrient_keys(key, unit, display_name, category)
            VALUES(?,?,?,?)
            """,
            (nk.key, nk.unit, nk.display_name, nk.category),
        )


def _ensure_nutrient_key(conn, key: str, unit: str | None) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO nutrient_keys(key, unit)
        VALUES(?,?)
        """,
        (key, unit),
    )


def log_event(
    *,
    consumed_at: datetime | None,
    alias: str | None,
    label: str,
    count: float = 1.0,
    unit: str | None = None,
    kcal: float | None = None,
    protein_g: float | None = None,
    fat_g: float | None = None,
    carbs_g: float | None = None,
    micros: dict[str, float] | None = None,
    note: str | None = None,
) -> None:
    dt = consumed_at or datetime.now().astimezone(LOCAL_TZ)
    local_date = local_date_of(dt)
    with db() as conn:
        _seed_nutrient_keys(conn)

        cur = conn.execute(
            """
            INSERT INTO nutrition_events(
              consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                dt.astimezone(LOCAL_TZ).isoformat(),
                local_date,
                alias,
                label,
                float(count),
                unit,
                kcal,
                protein_g,
                fat_g,
                carbs_g,
                json.dumps(micros, ensure_ascii=False) if micros else None,
                note,
            ),
        )
        event_id = cur.lastrowid

        # Dual-write nutrients (absolute amounts per event, already multiplied by count)
        nutrients: dict[str, tuple[float, str | None]] = {}
        if kcal is not None:
            nutrients["energy_kcal"] = (float(kcal) * float(count), "kcal")
        if protein_g is not None:
            nutrients["protein_g"] = (float(protein_g) * float(count), "g")
        if fat_g is not None:
            nutrients["fat_g"] = (float(fat_g) * float(count), "g")
        if carbs_g is not None:
            nutrients["carbs_g"] = (float(carbs_g) * float(count), "g")

        if micros:
            for k, v in micros.items():
                if isinstance(v, (int, float)):
                    nutrients[k] = (float(v) * float(count), None)

        for k, (v, u) in nutrients.items():
            _ensure_nutrient_key(conn, k, u)
            conn.execute(
                """
                INSERT INTO nutrition_nutrients(event_id, local_date, nutrient_key, value, unit)
                VALUES(?,?,?,?,?)
                """,
                (event_id, local_date, k, v, u),
            )


def log_alias(alias: str, *, consumed_at: datetime | None = None, count: float = 1.0, note: str | None = None) -> None:
    item = CATALOG.get(alias)
    if item is None:
        raise ValueError(f"Unknown alias: {alias}")

    # If an alias item lacks micros, estimate them to avoid missing micronutrients.
    micros = item.micros
    if micros is None and item.kcal is not None and float(item.kcal) > 0:
        from .estimator import estimate_micros

        micros = estimate_micros(
            item.label,
            kcal=float(item.kcal),
            protein_g=item.protein_g,
            fat_g=item.fat_g,
            carbs_g=item.carbs_g,
        )

    log_event(
        consumed_at=consumed_at,
        alias=item.alias,
        label=item.label,
        count=count,
        unit=item.unit,
        kcal=item.kcal,
        protein_g=item.protein_g,
        fat_g=item.fat_g,
        carbs_g=item.carbs_g,
        micros=micros,
        note=note,
    )


def get_day_events(local_date: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, consumed_at, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
            FROM nutrition_events
            WHERE local_date = ?
            ORDER BY consumed_at ASC
            """,
            (local_date,),
        ).fetchall()

    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        alias = d.get("alias")
        # Normalize labels from old logs to current catalog labels.
        if alias and alias in CATALOG:
            d["label"] = CATALOG[alias].label
        mj = d.get("micros_json")
        if mj:
            try:
                d["micros"] = json.loads(mj)
            except Exception:
                d["micros"] = None
        else:
            d["micros"] = None
        out.append(d)
    return out


def delete_event(event_id: int) -> bool:
    with db() as conn:
        conn.execute(
            "DELETE FROM nutrition_nutrients WHERE event_id = ?",
            (event_id,),
        )
        cur = conn.execute(
            "DELETE FROM nutrition_events WHERE id = ?",
            (event_id,),
        )
    return cur.rowcount > 0


def get_day_totals(local_date: str) -> dict[str, Any]:
    # Preferred: sum from normalized table
    with db() as conn:
        rows = conn.execute(
            """
            SELECT nutrient_key, SUM(value) AS total
            FROM nutrition_nutrients
            WHERE local_date = ?
            GROUP BY nutrient_key
            """,
            (local_date,),
        ).fetchall()

    totals = {r["nutrient_key"]: float(r["total"]) for r in rows}

    return {
        "kcal": totals.get("energy_kcal"),
        "protein_g": totals.get("protein_g"),
        "fat_g": totals.get("fat_g"),
        "carbs_g": totals.get("carbs_g"),
        # all other keys
        "micros": {k: v for k, v in totals.items() if k not in ("energy_kcal", "protein_g", "fat_g", "carbs_g")},
    }
