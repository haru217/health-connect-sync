from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Iterable

from .db import db

LOCAL_TZ = datetime.now().astimezone().tzinfo

# Diet heuristics
PLATEAU_THRESHOLD_KG_PER_7D = -0.1  # MA7 Δ7d > -0.1kg => plateau-ish
GAIN_THRESHOLD_KG_PER_7D = 0.1  # MA7 Δ7d > 0.1kg => gain-ish
SLOW_LOSS_THRESHOLD_KG_PER_7D = -0.25  # MA7 Δ7d > -0.25kg => slow_loss

# Insight heuristics (tunable)
STEPS_DROP_RATIO = 0.85
STEPS_DROP_ABS = -1500  # steps/day
STEPS_LOW_AVG = 7000
STEPS_SUGGEST_DELTA = 2000

ACTIVE_CAL_DROP_RATIO = 0.85
ACTIVE_CAL_LOW_AVG = 250  # kcal/day (very rough)

SLEEP_SHORT_MIN = 360  # 6h
SLEEP_DROP_RATIO = 0.85

BMR_PLAUSIBLE_MIN_KCAL_PER_DAY = 600.0
BMR_PLAUSIBLE_MAX_KCAL_PER_DAY = 4000.0
BMR_FIXED_KCAL_PER_DAY = 1680.0


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _local_day(dt: datetime) -> str:
    # Convert to local timezone for "daily" aggregations.
    try:
        return dt.astimezone(LOCAL_TZ).date().isoformat()
    except Exception:
        return dt.date().isoformat()


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except Exception:
            return None
    return None


def _find_number(obj: Any, key_candidates: set[str], max_depth: int = 6) -> float | None:
    def rec(x: Any, depth: int) -> float | None:
        if depth > max_depth:
            return None
        if isinstance(x, dict):
            # direct hit
            for k, v in x.items():
                if k in key_candidates:
                    n = _to_float(v)
                    if n is not None:
                        return n
            # dive
            for v in x.values():
                hit = rec(v, depth + 1)
                if hit is not None:
                    return hit
        if isinstance(x, list):
            for v in x:
                hit = rec(v, depth + 1)
                if hit is not None:
                    return hit
        return None

    return rec(obj, 0)


def _collapse_day_source_max(m: dict[tuple[str, str], float]) -> dict[str, float]:
    """Avoid double counting when the same metric is mirrored by multiple sources."""
    out: dict[str, float] = {}
    for (day, _source), value in m.items():
        cur = out.get(day)
        if cur is None or value > cur:
            out[day] = value
    return out


def _series_from_map_num(m: dict[str, float], field: str) -> list[dict[str, Any]]:
    return [{"date": k, field: m[k]} for k in sorted(m.keys())]


def _latest_per_day(rows: Iterable[tuple[datetime, float]]) -> dict[str, float]:
    best: dict[str, tuple[datetime, float]] = {}
    for dt, v in rows:
        day = _local_day(dt)
        cur = best.get(day)
        if cur is None or dt > cur[0]:
            best[day] = (dt, v)
    return {k: best[k][1] for k in best.keys()}


def _build_daily_sparse(m: dict[str, float], field: str) -> list[dict[str, Any]]:
    """Build daily series with None for missing days (no carry-forward)."""
    if not m:
        return []
    days_sorted = sorted(m.keys())
    start = date.fromisoformat(days_sorted[0])
    end = date.fromisoformat(days_sorted[-1])

    out: list[dict[str, Any]] = []
    cur = start
    while cur <= end:
        ds = cur.isoformat()
        if ds in m:
            out.append({"date": ds, field: float(m[ds]), "measured": True})
        else:
            out.append({"date": ds, field: None, "measured": False})
        cur += timedelta(days=1)
    return out


def _build_daily_carry_forward(m: dict[str, float], field: str) -> list[dict[str, Any]]:
    """Build daily series carrying last value forward (useful for weight smoothing)."""
    if not m:
        return []
    days_sorted = sorted(m.keys())
    start = date.fromisoformat(days_sorted[0])
    end = date.fromisoformat(days_sorted[-1])

    out: list[dict[str, Any]] = []
    cur = start
    last_val: float | None = None
    while cur <= end:
        ds = cur.isoformat()
        if ds in m:
            last_val = float(m[ds])
            out.append({"date": ds, field: last_val, "measured": True})
        else:
            out.append({"date": ds, field: last_val, "measured": False})
        cur += timedelta(days=1)
    return out


def _merged_interval_minutes(intervals: list[tuple[datetime, datetime]]) -> float:
    if not intervals:
        return 0.0
    normalized = sorted(intervals, key=lambda x: x[0])
    cur_start, cur_end = normalized[0]
    total_sec = 0.0
    for st, et in normalized[1:]:
        if st <= cur_end:
            if et > cur_end:
                cur_end = et
        else:
            total_sec += max(0.0, (cur_end - cur_start).total_seconds())
            cur_start, cur_end = st, et
    total_sec += max(0.0, (cur_end - cur_start).total_seconds())
    return total_sec / 60.0


def _avg_tail(daily: list[dict[str, Any]], field: str, n_days: int) -> tuple[float | None, int]:
    if not daily:
        return None, 0
    tail = daily[-n_days:]
    vals = [float(x[field]) for x in tail if x.get(field) is not None]
    if not vals:
        return None, 0
    return (sum(vals) / len(vals)), len(vals)


def _avg_prev_tail(daily: list[dict[str, Any]], field: str, n_days: int) -> tuple[float | None, int]:
    if len(daily) < (2 * n_days):
        return None, 0
    prev = daily[-2 * n_days : -n_days]
    vals = [float(x[field]) for x in prev if x.get(field) is not None]
    if not vals:
        return None, 0
    return (sum(vals) / len(vals)), len(vals)


def _moving_average(values: list[float | None], window: int = 7, min_points: int = 3) -> list[float | None]:
    out: list[float | None] = []
    for i in range(len(values)):
        from_i = max(0, i - window + 1)
        slice_ = [v for v in values[from_i : i + 1] if v is not None]
        if len(slice_) < min_points:
            out.append(None)
        else:
            out.append(sum(slice_) / len(slice_))
    return out


def _to_percent(v: float | None) -> float | None:
    if v is None:
        return None
    # Some sources send percentage as 0-1, others as 0-100.
    if 0 <= v <= 1.2:
        return v * 100.0
    return v


def _extract_distance_km(payload: dict[str, Any]) -> float | None:
    km = _find_number(payload, {"inKilometers", "kilometers"})
    if km is not None:
        return km
    m = _find_number(payload, {"inMeters", "meters"})
    if m is not None:
        return m / 1000.0
    mi = _find_number(payload, {"inMiles", "miles"})
    if mi is not None:
        return mi * 1.609344
    return None


def _extract_speed_kmh(sample_or_payload: dict[str, Any]) -> float | None:
    kmh = _find_number(sample_or_payload, {"kilometersPerHour", "inKilometersPerHour"})
    if kmh is not None:
        return kmh
    mps = _find_number(sample_or_payload, {"metersPerSecond", "inMetersPerSecond"})
    if mps is not None:
        return mps * 3.6
    mph = _find_number(sample_or_payload, {"milesPerHour", "inMilesPerHour"})
    if mph is not None:
        return mph * 1.609344
    return None


def _extract_bmr_kcal_per_day(payload: dict[str, Any]) -> float | None:
    kcal = _find_number(payload, {"kilocaloriesPerDay", "inKilocaloriesPerDay"})
    if kcal is not None:
        return float(kcal)
    watts = _find_number(payload, {"watts", "inWatts"})
    if watts is not None:
        # W -> kcal/day
        return float(watts) * 86400.0 / 4184.0
    return None


def _is_plausible_bmr(kcal_per_day: float) -> bool:
    return BMR_PLAUSIBLE_MIN_KCAL_PER_DAY <= kcal_per_day <= BMR_PLAUSIBLE_MAX_KCAL_PER_DAY


def _diet_from_weight_daily(weight_daily: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(weight_daily) < 2:
        return None

    vals = [x.get("kg") for x in weight_daily]
    ma7 = _moving_average([float(v) if v is not None else None for v in vals], window=7, min_points=3)

    if ma7[-1] is None:
        return None

    ma7_today = float(ma7[-1])
    ma7_7d_ago = float(ma7[-8]) if len(ma7) >= 8 and ma7[-8] is not None else None
    ma7_delta7d = (ma7_today - ma7_7d_ago) if ma7_7d_ago is not None else None

    # fallback weekly delta using raw daily values
    last = weight_daily[-1].get("kg")
    first = weight_daily[0].get("kg")
    if last is None or first is None:
        raw_delta = None
    else:
        raw_delta = float(last) - float(first)

    plateau = (ma7_delta7d is not None) and (ma7_delta7d > PLATEAU_THRESHOLD_KG_PER_7D)

    trend: str
    if ma7_delta7d is None:
        trend = "unknown"
    elif ma7_delta7d > GAIN_THRESHOLD_KG_PER_7D:
        trend = "gain"
    elif ma7_delta7d > PLATEAU_THRESHOLD_KG_PER_7D:
        trend = "plateau"
    elif ma7_delta7d > SLOW_LOSS_THRESHOLD_KG_PER_7D:
        trend = "slow_loss"
    else:
        trend = "loss"

    est_deficit = None
    if ma7_delta7d is not None:
        # kg/7d -> kcal/day
        est_deficit = -(ma7_delta7d * 7700.0) / 7.0

    return {
        "plateau": plateau,
        "trend": trend,
        "ma7Delta7d": ma7_delta7d,
        "estimatedDeficitKcalPerDay": est_deficit,
        "rawDeltaFromStart": raw_delta,
    }


def build_summary() -> dict[str, Any]:
    with db() as conn:
        total = int(conn.execute("SELECT COUNT(*) AS c FROM health_records").fetchone()["c"])

        by_type_rows = conn.execute(
            "SELECT type, COUNT(*) AS c FROM health_records GROUP BY type ORDER BY c DESC"
        ).fetchall()
        by_type = {r["type"]: int(r["c"]) for r in by_type_rows}

        # Steps (dedupe by source, then per-day max)
        steps_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='StepsRecord'"
        ).fetchall()
        steps_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        for r in steps_rows:
            dt = _parse_iso(r["start_time"])
            if not dt:
                continue
            day = _local_day(dt)
            try:
                payload = json.loads(r["payload_json"])
                c = _to_float(payload.get("count"))
                if c is None:
                    continue
                source = r["source"] or "unknown"
                steps_by_day_source[(day, source)] += c
            except Exception:
                continue
        steps_by_date = _collapse_day_source_max(steps_by_day_source)

        # Distance (km, sum by day)
        dist_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='DistanceRecord'"
        ).fetchall()
        distance_km_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        for r in dist_rows:
            dt = _parse_iso(r["start_time"])
            if not dt:
                continue
            day = _local_day(dt)
            try:
                payload = json.loads(r["payload_json"])
                km = _extract_distance_km(payload)
                if km is None:
                    continue
                source = r["source"] or "unknown"
                distance_km_by_day_source[(day, source)] += km
            except Exception:
                continue
        distance_km_by_date = _collapse_day_source_max(distance_km_by_day_source)

        # Weight (latest per day)
        weight_rows = conn.execute(
            "SELECT time, start_time, end_time, payload_json FROM health_records WHERE type='WeightRecord'"
        ).fetchall()
        weight_points: list[tuple[datetime, float]] = []
        for r in weight_rows:
            dt = _parse_iso(r["time"]) or _parse_iso(r["end_time"]) or _parse_iso(r["start_time"])
            if not dt:
                continue
            try:
                payload = json.loads(r["payload_json"])
                kg = _find_number(payload, {"inKilograms", "kilograms", "kg"})
                if kg is None:
                    continue
                weight_points.append((dt, float(kg)))
            except Exception:
                continue
        weight_by_date = _latest_per_day(weight_points)

        # Active calories (sum by day)
        active_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='ActiveCaloriesBurnedRecord'"
        ).fetchall()
        active_kcal_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        for r in active_rows:
            dt = _parse_iso(r["start_time"])
            if not dt:
                continue
            day = _local_day(dt)
            try:
                payload = json.loads(r["payload_json"])
                kcal = _find_number(payload, {"inKilocalories", "kilocalories", "kcal"})
                if kcal is None:
                    continue
                source = r["source"] or "unknown"
                active_kcal_by_day_source[(day, source)] += float(kcal)
            except Exception:
                continue
        active_kcal_by_date = _collapse_day_source_max(active_kcal_by_day_source)

        # Total calories burned (sum by day)
        total_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='TotalCaloriesBurnedRecord'"
        ).fetchall()
        total_kcal_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        for r in total_rows:
            dt = _parse_iso(r["start_time"])
            if not dt:
                continue
            day = _local_day(dt)
            try:
                payload = json.loads(r["payload_json"])
                kcal = _find_number(payload, {"inKilocalories", "kilocalories", "kcal"})
                if kcal is None:
                    continue
                source = r["source"] or "unknown"
                total_kcal_by_day_source[(day, source)] += float(kcal)
            except Exception:
                continue
        total_kcal_by_date = _collapse_day_source_max(total_kcal_by_day_source)

        # Intake calories (manual/openclaw input)
        intake_rows = conn.execute("SELECT day, intake_kcal FROM intake_calories_daily").fetchall()
        intake_kcal_manual_by_date = {r["day"]: float(r["intake_kcal"]) for r in intake_rows}

        # Sleep minutes (dedupe overlaps by source/day; assign to start date)
        sleep_rows = conn.execute(
            "SELECT start_time, end_time, source FROM health_records WHERE type='SleepSessionRecord'"
        ).fetchall()
        sleep_intervals_by_day_source: dict[tuple[str, str], list[tuple[datetime, datetime]]] = (
            defaultdict(list)
        )
        for r in sleep_rows:
            st = _parse_iso(r["start_time"])
            et = _parse_iso(r["end_time"])
            if not st or not et:
                continue
            if et <= st:
                continue
            day = _local_day(st)
            source = r["source"] or "unknown"
            sleep_intervals_by_day_source[(day, source)].append((st, et))

        sleep_min_by_day_source: dict[tuple[str, str], float] = {}
        for key, intervals in sleep_intervals_by_day_source.items():
            sleep_min_by_day_source[key] = _merged_interval_minutes(intervals)

        sleep_min_by_date = _collapse_day_source_max(sleep_min_by_day_source)
        sleep_hour_by_date = {k: v / 60.0 for k, v in sleep_min_by_date.items()}

        # Speed (km/h, daily average from samples)
        speed_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='SpeedRecord'"
        ).fetchall()
        speed_sum_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        speed_cnt_by_day_source: dict[tuple[str, str], int] = defaultdict(int)
        for r in speed_rows:
            source = r["source"] or "unknown"
            default_dt = _parse_iso(r["start_time"])
            try:
                payload = json.loads(r["payload_json"])
                samples = payload.get("samples")
                if isinstance(samples, list) and samples:
                    for s in samples:
                        if not isinstance(s, dict):
                            continue
                        sdt = _parse_iso(s.get("time")) or default_dt
                        if not sdt:
                            continue
                        kmh = _extract_speed_kmh(s)
                        if kmh is None:
                            continue
                        day = _local_day(sdt)
                        speed_sum_by_day_source[(day, source)] += kmh
                        speed_cnt_by_day_source[(day, source)] += 1
                else:
                    if not default_dt:
                        continue
                    kmh = _extract_speed_kmh(payload)
                    if kmh is None:
                        continue
                    day = _local_day(default_dt)
                    speed_sum_by_day_source[(day, source)] += kmh
                    speed_cnt_by_day_source[(day, source)] += 1
            except Exception:
                continue
        speed_kmh_by_day_source: dict[tuple[str, str], float] = {}
        for k, total_kmh in speed_sum_by_day_source.items():
            n = speed_cnt_by_day_source.get(k, 0)
            if n > 0:
                speed_kmh_by_day_source[k] = total_kmh / n
        speed_kmh_by_date = _collapse_day_source_max(speed_kmh_by_day_source)

        # Heart rate (bpm, daily average from samples)
        hr_rows = conn.execute(
            "SELECT start_time, source, payload_json FROM health_records WHERE type='HeartRateRecord'"
        ).fetchall()
        hr_sum_by_day_source: dict[tuple[str, str], float] = defaultdict(float)
        hr_cnt_by_day_source: dict[tuple[str, str], int] = defaultdict(int)
        for r in hr_rows:
            source = r["source"] or "unknown"
            default_dt = _parse_iso(r["start_time"])
            try:
                payload = json.loads(r["payload_json"])
                samples = payload.get("samples")
                if isinstance(samples, list) and samples:
                    for s in samples:
                        if not isinstance(s, dict):
                            continue
                        sdt = _parse_iso(s.get("time")) or default_dt
                        if not sdt:
                            continue
                        bpm = _find_number(s, {"beatsPerMinute"})
                        if bpm is None:
                            continue
                        day = _local_day(sdt)
                        hr_sum_by_day_source[(day, source)] += bpm
                        hr_cnt_by_day_source[(day, source)] += 1
                else:
                    if not default_dt:
                        continue
                    bpm = _find_number(payload, {"beatsPerMinute"})
                    if bpm is None:
                        continue
                    day = _local_day(default_dt)
                    hr_sum_by_day_source[(day, source)] += bpm
                    hr_cnt_by_day_source[(day, source)] += 1
            except Exception:
                continue
        hr_bpm_by_day_source: dict[tuple[str, str], float] = {}
        for k, total_bpm in hr_sum_by_day_source.items():
            n = hr_cnt_by_day_source.get(k, 0)
            if n > 0:
                hr_bpm_by_day_source[k] = total_bpm / n
        heart_rate_bpm_by_date = _collapse_day_source_max(hr_bpm_by_day_source)

        # Resting heart rate (bpm, latest per day)
        rhr_rows = conn.execute(
            "SELECT time, start_time, end_time, payload_json FROM health_records WHERE type='RestingHeartRateRecord'"
        ).fetchall()
        rhr_points: list[tuple[datetime, float]] = []
        for r in rhr_rows:
            dt = _parse_iso(r["time"]) or _parse_iso(r["end_time"]) or _parse_iso(r["start_time"])
            if not dt:
                continue
            try:
                payload = json.loads(r["payload_json"])
                bpm = _find_number(payload, {"beatsPerMinute"})
                if bpm is None:
                    continue
                rhr_points.append((dt, bpm))
            except Exception:
                continue
        resting_heart_rate_bpm_by_date = _latest_per_day(rhr_points)

        # Oxygen saturation (% , latest per day)
        spo2_rows = conn.execute(
            "SELECT time, start_time, end_time, payload_json FROM health_records WHERE type='OxygenSaturationRecord'"
        ).fetchall()
        spo2_points: list[tuple[datetime, float]] = []
        for r in spo2_rows:
            dt = _parse_iso(r["time"]) or _parse_iso(r["end_time"]) or _parse_iso(r["start_time"])
            if not dt:
                continue
            try:
                payload = json.loads(r["payload_json"])
                pct = _find_number(payload, {"value", "percentage", "percent"})
                pct = _to_percent(pct)
                if pct is None:
                    continue
                spo2_points.append((dt, pct))
            except Exception:
                continue
        oxygen_saturation_pct_by_date = _latest_per_day(spo2_points)

        # Basal Metabolic Rate (kcal/day, latest per day)
        # Some data sources emit implausibly small values (e.g., ~35 kcal/day).
        # If any plausible values exist, ignore implausible ones.
        bmr_rows = conn.execute(
            "SELECT time, start_time, end_time, payload_json FROM health_records WHERE type='BasalMetabolicRateRecord'"
        ).fetchall()
        bmr_candidates: list[tuple[datetime, float]] = []
        for r in bmr_rows:
            dt = _parse_iso(r["time"]) or _parse_iso(r["end_time"]) or _parse_iso(r["start_time"])
            if not dt:
                continue
            try:
                payload = json.loads(r["payload_json"])
                kcal = _extract_bmr_kcal_per_day(payload)
                if kcal is None:
                    continue
                bmr_candidates.append((dt, float(kcal)))
            except Exception:
                continue
        has_plausible_bmr = any(_is_plausible_bmr(v) for _, v in bmr_candidates)
        bmr_points = [
            (dt, v)
            for dt, v in bmr_candidates
            if (not has_plausible_bmr) or _is_plausible_bmr(v)
        ]
        basal_metabolic_rate_kcal_by_date = _latest_per_day(bmr_points)

        # Body fat (% , latest per day)
        bf_rows = conn.execute(
            "SELECT time, start_time, end_time, payload_json FROM health_records WHERE type='BodyFatRecord'"
        ).fetchall()
        bf_points: list[tuple[datetime, float]] = []
        for r in bf_rows:
            dt = _parse_iso(r["time"]) or _parse_iso(r["end_time"]) or _parse_iso(r["start_time"])
            if not dt:
                continue
            try:
                payload = json.loads(r["payload_json"])
                pct = _find_number(payload, {"value", "percentage", "percent"})
                pct = _to_percent(pct)
                if pct is None:
                    continue
                bf_points.append((dt, pct))
            except Exception:
                continue
        body_fat_pct_by_date = _latest_per_day(bf_points)

    # User preference: keep BMR fixed at 1680 kcal/day across the dashboard timeline.
    bmr_anchor_days = (
        set(total_kcal_by_date.keys())
        | set(intake_kcal_manual_by_date.keys())
        | set(active_kcal_by_date.keys())
        | set(weight_by_date.keys())
        | set(steps_by_date.keys())
    )
    if bmr_anchor_days:
        bmr_start = date.fromisoformat(min(bmr_anchor_days))
        bmr_end = date.fromisoformat(max(bmr_anchor_days))
    else:
        today = datetime.now(LOCAL_TZ).date()
        bmr_start = today
        bmr_end = today

    basal_metabolic_rate_kcal_by_date = {}
    cur = bmr_start
    while cur <= bmr_end:
        basal_metabolic_rate_kcal_by_date[cur.isoformat()] = BMR_FIXED_KCAL_PER_DAY
        cur += timedelta(days=1)

    # Stabilize total calories to avoid partial-day undercount.
    # Use the larger of:
    # - recorded total calories
    # - BMR + active calories
    total_anchor_days = (
        set(total_kcal_by_date.keys())
        | set(active_kcal_by_date.keys())
        | set(basal_metabolic_rate_kcal_by_date.keys())
    )
    total_kcal_effective_by_date: dict[str, float] = {}
    for d in sorted(total_anchor_days):
        raw_total = total_kcal_by_date.get(d)
        floor_total = float(
            basal_metabolic_rate_kcal_by_date.get(d, 0.0) + active_kcal_by_date.get(d, 0.0)
        )
        if raw_total is None:
            total_kcal_effective_by_date[d] = floor_total
        else:
            total_kcal_effective_by_date[d] = float(max(float(raw_total), floor_total))
    total_kcal_by_date = total_kcal_effective_by_date

    # When only one intake is entered, use the latest value as the default for
    # recent days so week/month charts are interpretable.
    intake_kcal_by_date = dict(intake_kcal_manual_by_date)
    if total_kcal_by_date and intake_kcal_manual_by_date:
        latest_intake_day = max(intake_kcal_manual_by_date.keys())
        default_intake = float(intake_kcal_manual_by_date[latest_intake_day])
        for d in sorted(total_kcal_by_date.keys()):
            if d not in intake_kcal_by_date:
                intake_kcal_by_date[d] = default_intake

    # Measurement-only series (as-is)
    steps_series = _series_from_map_num(steps_by_date, "steps")
    distance_series = _series_from_map_num(distance_km_by_date, "km")
    weight_series = _series_from_map_num(weight_by_date, "kg")
    active_series = _series_from_map_num(active_kcal_by_date, "kcal")
    total_series = _series_from_map_num(total_kcal_by_date, "kcal")
    intake_series = _series_from_map_num(intake_kcal_by_date, "kcal")
    sleep_series = _series_from_map_num(sleep_min_by_date, "minutes")
    sleep_hour_series = _series_from_map_num(sleep_hour_by_date, "hours")
    speed_series = _series_from_map_num(speed_kmh_by_date, "kmh")
    hr_series = _series_from_map_num(heart_rate_bpm_by_date, "bpm")
    rhr_series = _series_from_map_num(resting_heart_rate_bpm_by_date, "bpm")
    spo2_series = _series_from_map_num(oxygen_saturation_pct_by_date, "pct")
    # Carry-forward for BMR so the latest valid value remains visible day-to-day.
    bmr_series = _build_daily_carry_forward(basal_metabolic_rate_kcal_by_date, "kcalPerDay")
    body_fat_series = _series_from_map_num(body_fat_pct_by_date, "pct")

    calorie_balance_by_date: dict[str, float] = {}
    for d in sorted(set(total_kcal_by_date.keys()) | set(intake_kcal_by_date.keys())):
        burned = total_kcal_by_date.get(d)
        intake = intake_kcal_by_date.get(d)
        if burned is None or intake is None:
            continue
        calorie_balance_by_date[d] = burned - intake
    calorie_balance_series = _series_from_map_num(calorie_balance_by_date, "kcal")

    # Daily series (for averages / trend)
    weight_daily = _build_daily_carry_forward(weight_by_date, "kg")
    steps_daily = _build_daily_sparse(steps_by_date, "steps")
    active_daily = _build_daily_sparse(active_kcal_by_date, "kcal")
    total_daily = _build_daily_sparse(total_kcal_by_date, "kcal")
    intake_daily = _build_daily_sparse(intake_kcal_by_date, "kcal")
    sleep_daily = _build_daily_sparse(sleep_min_by_date, "minutes")

    diet = _diet_from_weight_daily(weight_daily)

    # Insights (diet-oriented)
    insights: list[dict[str, str]] = []

    # weigh-in frequency in last 7 days
    if weight_daily:
        tail = weight_daily[-7:]
        weighins_last7 = sum(1 for x in tail if x.get("measured"))
        if weighins_last7 < 4:
            insights.append({
                "level": "info",
                "message": "体重の記録が少なめ（直近7日で4回未満）。トレンド/停滞判定の精度が落ちるかも",
            })

    steps_avg7, steps_n7 = _avg_tail(steps_daily, "steps", 7)
    steps_avg_prev7, steps_nprev7 = _avg_prev_tail(steps_daily, "steps", 7)
    sleep_avg7, sleep_n7 = _avg_tail(sleep_daily, "minutes", 7)
    sleep_avg_prev7, sleep_nprev7 = _avg_prev_tail(sleep_daily, "minutes", 7)
    active_avg7, active_n7 = _avg_tail(active_daily, "kcal", 7)
    active_avg_prev7, active_nprev7 = _avg_prev_tail(active_daily, "kcal", 7)
    total_avg7, _ = _avg_tail(total_daily, "kcal", 7)
    intake_avg7, _ = _avg_tail(intake_daily, "kcal", 7)

    def fmt0(x: float | None) -> str:
        if x is None:
            return "-"
        try:
            return str(int(round(float(x))))
        except Exception:
            return "-"

    def fmt1(x: float | None) -> str:
        if x is None:
            return "-"
        try:
            return f"{float(x):.1f}"
        except Exception:
            return "-"

    # Data availability hints
    if not active_series and not total_series:
        insights.append({"level": "info", "message": "消費カロリーのデータが見当たらない（提供元/権限/同期範囲を確認）"})
    if not intake_series:
        insights.append({"level": "info", "message": "摂取カロリー未入力（OpenClawから日次入力すると収支評価が可能）"})
    if not sleep_series:
        insights.append({"level": "info", "message": "睡眠データが見当たらない（提供元/権限/同期範囲を確認）"})

    if total_avg7 is not None and intake_avg7 is not None:
        balance = total_avg7 - intake_avg7
        insights.append({
            "level": "info",
            "message": f"直近7日平均の収支（摂取-総消費）は {fmt0(balance)} kcal/日",
        })

    if diet is None:
        insights.append({"level": "info", "message": "体重データがまだ少ないため、減量トレンド判定は保留"})
    else:
        trend = diet.get("trend")
        ma7_delta = diet.get("ma7Delta7d")

        if trend == "gain":
            insights.append({"level": "warn", "message": f"体重が増加傾向（MA7 Δ7d={fmt1(ma7_delta)}kg）。摂取＞消費の可能性"})
        elif trend == "plateau":
            insights.append({"level": "warn", "message": f"停滞気味（体重MA7 Δ7d={fmt1(ma7_delta)}kg / 閾値>{PLATEAU_THRESHOLD_KG_PER_7D}）。原因切り分けを推奨"})
        elif trend == "slow_loss":
            insights.append({"level": "info", "message": f"減ってはいるがペースは緩やか（MA7 Δ7d={fmt1(ma7_delta)}kg）"})
        elif trend == "loss":
            insights.append({"level": "info", "message": f"減量トレンド（MA7 Δ7d={fmt1(ma7_delta)}kg）"})

        if trend in ("plateau", "gain"):
            if steps_avg7 is not None:
                if steps_avg_prev7 is not None and steps_n7 >= 3 and steps_nprev7 >= 3:
                    diff = steps_avg7 - steps_avg_prev7
                    if steps_avg7 < steps_avg_prev7 * STEPS_DROP_RATIO or diff < STEPS_DROP_ABS:
                        insights.append({
                            "level": "warn",
                            "message": f"歩数が前週より低い（7日平均 {fmt0(steps_avg7)} → {fmt0(steps_avg_prev7)}）",
                        })
                if steps_avg7 < STEPS_LOW_AVG:
                    insights.append({
                        "level": "info",
                        "message": f"歩数の7日平均が少なめ（{fmt0(steps_avg7)}歩/日）。目安: +{STEPS_SUGGEST_DELTA}歩/日",
                    })

            if active_avg7 is not None:
                if active_avg_prev7 is not None and active_n7 >= 3 and active_nprev7 >= 3:
                    if active_avg7 < active_avg_prev7 * ACTIVE_CAL_DROP_RATIO:
                        insights.append({
                            "level": "warn",
                            "message": f"活動中消費カロリーが前週より低い（7日平均 {fmt0(active_avg7)} → {fmt0(active_avg_prev7)} kcal/日）",
                        })
                if active_avg7 < ACTIVE_CAL_LOW_AVG:
                    insights.append({
                        "level": "info",
                        "message": f"活動中消費カロリーが低め（7日平均 {fmt0(active_avg7)} kcal/日）",
                    })

            if sleep_avg7 is not None and sleep_n7 >= 3:
                sleep_h = sleep_avg7 / 60.0
                if sleep_avg7 < SLEEP_SHORT_MIN:
                    insights.append({
                        "level": "warn",
                        "message": f"睡眠が短め（7日平均 {fmt1(sleep_h)}h < 6.0h）。食欲/NEATに影響しやすい",
                    })
                elif sleep_avg_prev7 is not None and sleep_nprev7 >= 3 and sleep_avg7 < sleep_avg_prev7 * SLEEP_DROP_RATIO:
                    insights.append({
                        "level": "info",
                        "message": f"睡眠が前週より短い（7日平均 {fmt1(sleep_h)}h）",
                    })

            if not intake_series:
                insights.append({
                    "level": "info",
                    "message": "摂取カロリー未計測の場合、停滞の主因は『摂取増 or 消費減』のどちらか",
                })

        est = diet.get("estimatedDeficitKcalPerDay")
        if isinstance(est, (int, float)):
            if est < -100:
                insights.append({"level": "warn", "message": "推定ではカロリー収支がプラス（増量寄り）。食事量/間食の見直し余地"})
            elif est < 150:
                insights.append({"level": "info", "message": "推定赤字が小さめ。減量速度を上げるなら食事か活動で微調整"})

    return {
        "totalRecords": total,
        "byType": by_type,
        "stepsByDate": steps_series,
        "distanceKmByDate": distance_series,
        "weightByDate": weight_series,
        "weightDaily": weight_daily,
        "activeCaloriesByDate": active_series,
        "totalCaloriesByDate": total_series,
        "intakeCaloriesByDate": intake_series,
        "calorieBalanceByDate": calorie_balance_series,
        "sleepMinutesByDate": sleep_series,
        "sleepHoursByDate": sleep_hour_series,
        "speedKmhByDate": speed_series,
        "heartRateBpmByDate": hr_series,
        "restingHeartRateBpmByDate": rhr_series,
        "oxygenSaturationPctByDate": spo2_series,
        "basalMetabolicRateKcalByDate": bmr_series,
        "bodyFatPctByDate": body_fat_series,
        "diet": diet,
        "insights": insights,
    }
