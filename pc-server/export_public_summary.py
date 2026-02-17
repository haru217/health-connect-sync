from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.summary import build_summary

TARGET_WEIGHT_KG = 75.0


def _series_to_map(rows: list[dict[str, Any]] | None, value_key: str) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for r in rows or []:
        day = r.get("date")
        if not isinstance(day, str):
            continue
        v = r.get(value_key)
        if isinstance(v, (int, float)):
            out[day] = float(v)
        else:
            out[day] = None
    return out


def _relative_labels(days: list[str]) -> dict[str, str]:
    labels: dict[str, str] = {}
    n = len(days)
    for idx, day in enumerate(days):
        back = n - 1 - idx
        labels[day] = f"D-{back}" if back > 0 else "D0"
    return labels


def _latest_value(rows: list[dict[str, Any]] | None, value_key: str) -> float | None:
    if not rows:
        return None
    for r in reversed(rows):
        v = r.get(value_key)
        if isinstance(v, (int, float)):
            return float(v)
    return None


def _round_or_none(v: float | None, digits: int = 2) -> float | None:
    if v is None:
        return None
    return round(float(v), digits)


def build_public_payload(keep_dates: bool = False) -> dict[str, Any]:
    s = build_summary()

    weight = _series_to_map(s.get("weightByDate"), "kg")
    steps = _series_to_map(s.get("stepsByDate"), "steps")
    dist = _series_to_map(s.get("distanceKmByDate"), "km")
    active = _series_to_map(s.get("activeCaloriesByDate"), "kcal")
    total = _series_to_map(s.get("totalCaloriesByDate"), "kcal")
    intake = _series_to_map(s.get("intakeCaloriesByDate"), "kcal")
    balance = _series_to_map(s.get("calorieBalanceByDate"), "kcal")
    sleep = _series_to_map(s.get("sleepHoursByDate"), "hours")
    bmr = _series_to_map(s.get("basalMetabolicRateKcalByDate"), "kcalPerDay")
    body_fat = _series_to_map(s.get("bodyFatPctByDate"), "pct")

    all_days = sorted(
        set(weight.keys())
        | set(steps.keys())
        | set(dist.keys())
        | set(active.keys())
        | set(total.keys())
        | set(intake.keys())
        | set(balance.keys())
        | set(sleep.keys())
        | set(bmr.keys())
        | set(body_fat.keys())
    )

    labels = _relative_labels(all_days)
    points: list[dict[str, Any]] = []
    for day in all_days:
        points.append(
            {
                "day": day if keep_dates else labels[day],
                "weightKg": _round_or_none(weight.get(day), 1),
                "steps": _round_or_none(steps.get(day), 0),
                "distanceKm": _round_or_none(dist.get(day), 2),
                "activeCaloriesKcal": _round_or_none(active.get(day), 1),
                "totalCaloriesKcal": _round_or_none(total.get(day), 1),
                "intakeCaloriesKcal": _round_or_none(intake.get(day), 1),
                "calorieBalanceKcal": _round_or_none(balance.get(day), 1),
                "sleepHours": _round_or_none(sleep.get(day), 2),
                "bmrKcalPerDay": _round_or_none(bmr.get(day), 1),
                "bodyFatPct": _round_or_none(body_fat.get(day), 2),
            }
        )

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "privacy": {
            "containsRawRecords": False,
            "containsGps": False,
            "containsTimestamps": False,
            "dateMode": "iso" if keep_dates else "relative",
        },
        "goals": {
            "targetWeightKg": TARGET_WEIGHT_KG,
        },
        "latest": {
            "weightKg": _round_or_none(_latest_value(s.get("weightByDate"), "kg"), 1),
            "steps": _round_or_none(_latest_value(s.get("stepsByDate"), "steps"), 0),
            "distanceKm": _round_or_none(_latest_value(s.get("distanceKmByDate"), "km"), 2),
            "sleepHours": _round_or_none(_latest_value(s.get("sleepHoursByDate"), "hours"), 2),
            "activeCaloriesKcal": _round_or_none(
                _latest_value(s.get("activeCaloriesByDate"), "kcal"), 1
            ),
            "totalCaloriesKcal": _round_or_none(
                _latest_value(s.get("totalCaloriesByDate"), "kcal"), 1
            ),
            "intakeCaloriesKcal": _round_or_none(
                _latest_value(s.get("intakeCaloriesByDate"), "kcal"), 1
            ),
            "calorieBalanceKcal": _round_or_none(
                _latest_value(s.get("calorieBalanceByDate"), "kcal"), 1
            ),
            "bmrKcalPerDay": _round_or_none(
                _latest_value(s.get("basalMetabolicRateKcalByDate"), "kcalPerDay"), 1
            ),
            "bodyFatPct": _round_or_none(_latest_value(s.get("bodyFatPctByDate"), "pct"), 2),
        },
        "metrics": points,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export anonymized daily summary for GitHub Pages."
    )
    parser.add_argument(
        "--out",
        default="../docs/data/summary.json",
        help="Output JSON path (default: ../docs/data/summary.json from pc-server)",
    )
    parser.add_argument(
        "--keep-dates",
        action="store_true",
        help="Keep ISO dates instead of relative labels (D-6 ... D0).",
    )
    args = parser.parse_args()

    payload = build_public_payload(keep_dates=args.keep_dates)
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = (Path(__file__).resolve().parent / out_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"exported: {out_path}")
    print(f"points: {len(payload.get('metrics', []))}")
    print(f"dateMode: {payload['privacy']['dateMode']}")


if __name__ == "__main__":
    main()
