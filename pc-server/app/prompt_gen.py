from __future__ import annotations

from datetime import date, datetime, timedelta

from .db import db
from .profile import get_profile
from .nutrition import get_day_events, get_day_totals, CATALOG
from .summary import build_summary


def _today_local() -> date:
    return datetime.now().astimezone().date()


def _format_food_events(events: list[dict]) -> str:
    """食事イベントを人が読みやすい文字列に変換。"""
    if not events:
        return "（記録なし）"
    lines = []
    for e in events:
        parts = [e.get("label", "不明")]
        macros = []
        if e.get("kcal") is not None:
            macros.append(f"{e['kcal']:.0f}kcal")
        if e.get("protein_g") is not None:
            macros.append(f"P{e['protein_g']:.1f}g")
        if e.get("fat_g") is not None:
            macros.append(f"F{e['fat_g']:.1f}g")
        if e.get("carbs_g") is not None:
            macros.append(f"C{e['carbs_g']:.1f}g")
        if macros:
            parts.append(f"({', '.join(macros)})")
        lines.append("・" + " ".join(parts))
    return "\n".join(lines)


def _format_supplement_status(today_str: str) -> str:
    """今日チェック済みのサプリ一覧を返す。"""
    events = get_day_events(today_str)
    checked_aliases = {e["alias"] for e in events if e.get("alias")}
    lines = []
    for alias, item in CATALOG.items():
        mark = "✓" if alias in checked_aliases else "✗"
        lines.append(f"{mark} {item.label}")
    return "\n".join(lines) if lines else "（サプリ記録なし）"


def _get_hc_snippet(summary: dict, days: int) -> str:
    """build_summary() の結果から指定日数分の概要テキストを生成。"""
    today = _today_local()
    cutoff = (today - timedelta(days=days)).isoformat()

    def tail(series: list[dict], key: str, n: int) -> list[float]:
        filtered = [
            x[key] for x in series
            if x.get("date", "") >= cutoff and x.get(key) is not None
        ]
        return filtered[-n:]

    def avg(vals: list[float]) -> str:
        if not vals:
            return "データなし"
        return f"{sum(vals) / len(vals):.1f}"

    weight_series = summary.get("weightByDate", [])
    steps_series = summary.get("stepsByDate", [])
    sleep_series = summary.get("sleepHoursByDate", [])
    active_series = summary.get("activeCaloriesByDate", [])
    total_series = summary.get("totalCaloriesByDate", [])
    rhr_series = summary.get("restingHeartRateBpmByDate", [])

    latest_weight = None
    for x in reversed(weight_series):
        if x.get("kg") is not None:
            latest_weight = x["kg"]
            break

    lines = []
    lines.append(f"体重: 最新{latest_weight}kg / {days}日平均{avg(tail(weight_series, 'kg', days))}kg")
    lines.append(f"歩数: {days}日平均{avg(tail(steps_series, 'steps', days))}歩/日")
    lines.append(f"睡眠: {days}日平均{avg(tail(sleep_series, 'hours', days))}時間/日")
    lines.append(f"活動カロリー: {days}日平均{avg(tail(active_series, 'kcal', days))}kcal/日")
    lines.append(f"総消費カロリー: {days}日平均{avg(tail(total_series, 'kcal', days))}kcal/日")
    lines.append(f"安静時心拍: {avg(tail(rhr_series, 'bpm', days))}bpm")

    diet = summary.get("diet") or {}
    if diet.get("trend"):
        lines.append(f"体重トレンド: {diet['trend']} (MA7 Δ7d={diet.get('ma7Delta7d', 'N/A')}kg)")

    return "\n".join(lines)


def build_prompt(prompt_type: str) -> str:
    """
    prompt_type: "daily" | "weekly" | "monthly"
    """
    if prompt_type not in ("daily", "weekly", "monthly"):
        raise ValueError(f"Invalid prompt_type: {prompt_type}")

    today = _today_local()
    profile = get_profile() or {}

    name = profile.get("name") or "ユーザー"
    height = profile.get("height_cm") or 172
    birth_year = profile.get("birth_year") or 1985
    sex = profile.get("sex") or "male"
    goal_weight = profile.get("goal_weight_kg") or 75
    age = today.year - birth_year

    sex_ja = {"male": "男性", "female": "女性", "other": "その他"}.get(sex, "不明")

    # 期間設定
    if prompt_type == "daily":
        period_label = "昨日"
        target_date = (today - timedelta(days=1)).isoformat()
        days = 1
    elif prompt_type == "weekly":
        period_label = "過去7日間"
        target_date = today.isoformat()
        days = 7
    else:
        period_label = "過去30日間"
        target_date = today.isoformat()
        days = 30

    summary = build_summary()
    hc_snippet = _get_hc_snippet(summary, days)

    food_events = get_day_events(target_date)
    food_text = _format_food_events(food_events)
    totals = get_day_totals(target_date)
    suppl_text = _format_supplement_status(target_date)

    prompt = f"""# お願い
知識のある優しい友人として、医師・フィジカルトレーナー・管理栄養士の視点でアドバイスをください。
命令せず、励ましながら、数値根拠を示してください。

# ユーザー情報
- 名前: {name}
- 身長: {height}cm / 年齢: {age}歳 / 性別: {sex_ja}
- 現在体重: （最新HCデータ参照） / 目標体重: {goal_weight}kg

# 期間: {period_label}

## Health Connectデータ
{hc_snippet}

## 食事ログ（{target_date}）
{food_text}

### マクロ合計
- エネルギー: {totals.get('kcal') or 'データなし'}kcal
- タンパク質: {totals.get('protein_g') or 'データなし'}g
- 脂質: {totals.get('fat_g') or 'データなし'}g
- 炭水化物: {totals.get('carbs_g') or 'データなし'}g

## サプリ（{target_date}）
{suppl_text}

# 出力フォーマット
以下の3セクションで回答してください（Markdown形式）:

## 1. 体重・ダイエット視点（フィジカルトレーナー）
（カロリー収支・体重トレンド・活動量の評価と提案）

## 2. 健康・医療視点（医師）
（バイタル・睡眠・心拍・SpO2 の評価。異常があれば受診を促す）

## 3. 栄養・サプリ視点（管理栄養士）
（マクロ・マイクロ栄養素の過不足・サプリの適切さ）
"""
    return prompt


def calc_nutrient_targets(
    height_cm: float,
    weight_kg: float,
    birth_year: int,
    sex: str,
) -> list[dict]:
    """
    Harris-Benedict式でTDEEを算出し、各栄養素の推奨量を返す。
    日本人の食事摂取基準2020版に基づく。

    返り値: [
        {"key": str, "name": str, "unit": str, "target": float, "actual": float | None, "status": "green"|"yellow"|"red"}
    ]
    """
    from datetime import date as _date
    from .db import db
    import json

    today = _date.today()
    age = today.year - birth_year

    # Harris-Benedict BMR
    if sex == "female":
        bmr = 447.593 + 9.247 * weight_kg + 3.098 * height_cm - 4.330 * age
    else:
        bmr = 88.362 + 13.397 * weight_kg + 4.799 * height_cm - 5.677 * age

    # 活動係数 1.55（中程度の活動）
    tdee = bmr * 1.55

    # 減量目的で -20%
    target_kcal = tdee * 0.80

    # マクロ推奨量（減量セット: P30% F25% C45%）
    protein_target = (target_kcal * 0.30) / 4.0
    fat_target = (target_kcal * 0.25) / 9.0
    carbs_target = (target_kcal * 0.45) / 4.0

    # 微量栄養素（日本人食事摂取基準2020、30〜49歳男性ベース、性別で調整）
    # sex: "male" | "female" | "other"
    is_male = sex != "female"

    micro_targets = {
        "vitamin_d3_mcg": (15.0, "μg", "ビタミンD"),
        "vitamin_c_mg": (100.0, "mg", "ビタミンC"),
        "vitamin_e_mg": (6.0 if is_male else 5.0, "mg", "ビタミンE"),
        "vitamin_b1_mg": (1.4 if is_male else 1.1, "mg", "ビタミンB1"),
        "vitamin_b2_mg": (1.6 if is_male else 1.2, "mg", "ビタミンB2"),
        "folate_mcg": (240.0, "μg", "葉酸"),
        "calcium_mg": (750.0 if is_male else 650.0, "mg", "カルシウム"),
        "magnesium_mg": (370.0 if is_male else 290.0, "mg", "マグネシウム"),
        "zinc_mg": (11.0 if is_male else 8.0, "mg", "亜鉛"),
        "omega3_mg": (2000.0, "mg", "オメガ3"),
    }

    # 当日の実績値を取得
    today_str = today.isoformat()
    with db() as conn:
        rows = conn.execute(
            """
            SELECT nutrient_key, SUM(value) AS total
            FROM nutrition_nutrients
            WHERE local_date = ?
            GROUP BY nutrient_key
            """,
            (today_str,),
        ).fetchall()
    actuals = {r["nutrient_key"]: float(r["total"]) for r in rows}

    def status(actual: float | None, target: float) -> str:
        if actual is None:
            return "red"
        ratio = actual / target if target > 0 else 0
        if 0.80 <= ratio <= 1.20:
            return "green"
        elif 0.60 <= ratio <= 1.50:
            return "yellow"
        else:
            return "red"

    result = [
        {
            "key": "energy_kcal",
            "name": "エネルギー",
            "unit": "kcal",
            "target": round(target_kcal, 0),
            "actual": actuals.get("energy_kcal"),
            "status": status(actuals.get("energy_kcal"), target_kcal),
        },
        {
            "key": "protein_g",
            "name": "タンパク質",
            "unit": "g",
            "target": round(protein_target, 1),
            "actual": actuals.get("protein_g"),
            "status": status(actuals.get("protein_g"), protein_target),
        },
        {
            "key": "fat_g",
            "name": "脂質",
            "unit": "g",
            "target": round(fat_target, 1),
            "actual": actuals.get("fat_g"),
            "status": status(actuals.get("fat_g"), fat_target),
        },
        {
            "key": "carbs_g",
            "name": "炭水化物",
            "unit": "g",
            "target": round(carbs_target, 1),
            "actual": actuals.get("carbs_g"),
            "status": status(actuals.get("carbs_g"), carbs_target),
        },
    ]

    for key, (target_val, unit, name) in micro_targets.items():
        result.append({
            "key": key,
            "name": name,
            "unit": unit,
            "target": target_val,
            "actual": actuals.get(key),
            "status": status(actuals.get(key), target_val),
        })

    return result

