from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from .db import LOCAL_TZ
from .nutrition import get_day_events, get_day_totals
from .summary import build_summary


def _fmt(n: float | None, digits: int = 1) -> str:
    if n is None:
        return "-"
    return f"{n:.{digits}f}"


def _find_series_value(series: list[dict[str, Any]], date_str: str, field: str) -> float | None:
    for x in series:
        if x.get("date") == date_str:
            v = x.get(field)
            if v is None:
                return None
            return float(v)
    return None


def build_yesterday_report() -> str:
    today = datetime.now().astimezone(LOCAL_TZ).date()
    yday = (today - timedelta(days=1)).isoformat()

    s = build_summary()

    weight = _find_series_value(s.get("weightByDate", []), yday, "kg")
    steps = _find_series_value(s.get("stepsByDate", []), yday, "steps")
    active_kcal = _find_series_value(s.get("activeCaloriesByDate", []), yday, "kcal")
    total_kcal = _find_series_value(s.get("totalCaloriesByDate", []), yday, "kcal")
    sleep_min = _find_series_value(s.get("sleepMinutesByDate", []), yday, "minutes")

    diet = s.get("diet") or {}
    ma7d = diet.get("ma7Delta7d")
    est_def = diet.get("estimatedDeficitKcalPerDay")
    trend = diet.get("trend")

    events = get_day_events(yday)
    totals = get_day_totals(yday)

    lines: list[str] = []
    lines.append(f"【前日レポート】{yday}")
    lines.append("")
    lines.append("■ 体重/トレンド")
    lines.append(f"- 体重: {_fmt(weight)} kg")
    lines.append(f"- MA7 Δ7d: {_fmt(ma7d)} kg / trend: {trend}")
    lines.append(f"- 推定収支: {_fmt(est_def, 0)} kcal/日（超ラフ）")

    lines.append("")
    lines.append("■ 活動")
    lines.append(f"- 歩数: {_fmt(steps, 0)}")
    lines.append(f"- 活動中消費: {_fmt(active_kcal, 0)} kcal")
    lines.append(f"- 総消費: {_fmt(total_kcal, 0)} kcal")

    lines.append("")
    lines.append("■ 睡眠")
    lines.append(f"- 睡眠: {_fmt(sleep_min, 0)} 分")

    lines.append("")
    lines.append("■ 食事/サプリ（手入力）")
    if not events:
        lines.append("- （記録なし）")
    else:
        for e in events:
            alias = e.get("alias")
            label = e.get("label")
            count = e.get("count")
            unit = e.get("unit") or ""
            lines.append(f"- {label} x{count}{unit}" + (f" ({alias})" if alias else ""))
        if any(totals.get(k) is not None for k in ("kcal", "protein_g", "fat_g", "carbs_g")):
            lines.append(
                f"- 合計: kcal={_fmt(totals.get('kcal'),0)} / P={_fmt(totals.get('protein_g'),0)}g / F={_fmt(totals.get('fat_g'),0)}g / C={_fmt(totals.get('carbs_g'),0)}g"
            )
        else:
            lines.append("- 合計: （栄養値未登録のため算出なし）")

        micros = totals.get("micros") or {}
        if isinstance(micros, dict) and micros:
            # Print up to 12 micros to keep Discord readable
            items = sorted(micros.items())
            show = items[:12]
            micro_str = ", ".join([f"{k}={_fmt(v,0)}" for k, v in show])
            lines.append(f"- 微量栄養素: {micro_str}" + (" ..." if len(items) > 12 else ""))

    # insights (diet)
    ins = s.get("insights") or []
    if ins:
        lines.append("")
        lines.append("■ ヒント")
        for it in ins[:5]:
            lines.append(f"- {it.get('message')}")

    return "\n".join(lines)
