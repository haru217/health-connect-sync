# Health AI Advisor — Codex 実装指示書

## 概要

既存の `pc-server` に機能を追加する。既存ファイルの既存コードは**変更しない**。
追加・改修のみ。

---

## プロジェクト構造（現状）

```
health-connect-sync/
└── pc-server/
    ├── app/
    │   ├── __init__.py
    │   ├── db.py           ← テーブル追加のみ（init_db末尾に追記）
    │   ├── main.py         ← エンドポイント追加のみ
    │   ├── models.py       ← Pydanticモデル追加のみ
    │   ├── nutrition.py    ← 変更なし（CATALOG, log_event, get_day_events, get_day_totals を再利用）
    │   ├── summary.py      ← 変更なし（build_summary() を prompt_gen.py から呼び出す）
    │   ├── security.py     ← 変更なし（require_api_key を全新規エンドポイントに使う）
    │   ├── ui_template.html ← 全面改修（Step 5）
    │   └── ...（他ファイルは変更なし）
    ├── tests/
    │   ├── test_profile.py   ← 新規作成
    │   ├── test_reports.py   ← 新規作成
    │   ├── test_prompt_gen.py ← 新規作成
    │   └── test_nutrients.py  ← 新規作成
    └── ...
```

---

## Step 1: `app/db.py` — テーブル2つ追加

`init_db()` 関数の末尾（最後の `conn.execute` の後）に追記する。
**既存コードは一切変更しない。**

```python
# ---- 以下を init_db() 末尾に追記 ----

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profile (
              id INTEGER PRIMARY KEY,
              name TEXT,
              height_cm REAL,
              birth_year INTEGER,
              sex TEXT,
              goal_weight_kg REAL,
              updated_at TEXT NOT NULL
            );
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              report_date TEXT NOT NULL,
              report_type TEXT NOT NULL,
              prompt_used TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_reports_date ON ai_reports(report_date);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_reports_type ON ai_reports(report_type);"
        )
```

---

## Step 2: 新規ファイル3つ作成

### `app/profile.py`（新規）

```python
from __future__ import annotations

from .db import db, now_iso


def get_profile() -> dict | None:
    """id=1 のプロフィールを返す。未設定なら None。"""
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM user_profile WHERE id = 1"
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def upsert_profile(**kwargs) -> dict:
    """プロフィールを部分更新。渡されなかったキーは既存値を保持。"""
    current = get_profile() or {}
    fields = ["name", "height_cm", "birth_year", "sex", "goal_weight_kg"]
    merged = {f: kwargs.get(f, current.get(f)) for f in fields}
    merged["updated_at"] = now_iso()

    with db() as conn:
        conn.execute(
            """
            INSERT INTO user_profile(id, name, height_cm, birth_year, sex, goal_weight_kg, updated_at)
            VALUES(1, :name, :height_cm, :birth_year, :sex, :goal_weight_kg, :updated_at)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              height_cm=excluded.height_cm,
              birth_year=excluded.birth_year,
              sex=excluded.sex,
              goal_weight_kg=excluded.goal_weight_kg,
              updated_at=excluded.updated_at
            """,
            merged,
        )

    return get_profile()  # type: ignore[return-value]
```

---

### `app/reports.py`（新規）

```python
from __future__ import annotations

from .db import db, now_iso


def save_report(
    *,
    report_date: str,
    report_type: str,
    prompt_used: str,
    content: str,
) -> dict:
    with db() as conn:
        cur = conn.execute(
            """
            INSERT INTO ai_reports(report_date, report_type, prompt_used, content, created_at)
            VALUES(?, ?, ?, ?, ?)
            """,
            (report_date, report_type, prompt_used, content, now_iso()),
        )
        report_id = cur.lastrowid

    return get_report(report_id)  # type: ignore[return-value]


def list_reports(*, report_type: str | None = None, limit: int = 50) -> list[dict]:
    """content は先頭200文字のプレビューのみ返す。"""
    with db() as conn:
        if report_type:
            rows = conn.execute(
                """
                SELECT id, report_date, report_type, created_at,
                       SUBSTR(content, 1, 200) AS preview
                FROM ai_reports
                WHERE report_type = ?
                ORDER BY report_date DESC, created_at DESC
                LIMIT ?
                """,
                (report_type, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, report_date, report_type, created_at,
                       SUBSTR(content, 1, 200) AS preview
                FROM ai_reports
                ORDER BY report_date DESC, created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def get_report(report_id: int) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM ai_reports WHERE id = ?", (report_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_report(report_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM ai_reports WHERE id = ?", (report_id,)
        )
    return cur.rowcount > 0
```

---

### `app/prompt_gen.py`（新規）

```python
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
```

---

## Step 3: `app/models.py` — Pydanticモデル追加

既存コードの末尾に追記する。**既存クラスは変更しない。**

```python
# ---- 以下を models.py 末尾に追記 ----

from typing import Literal  # 既存のimportがなければ追加

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    height_cm: Optional[float] = Field(default=None, ge=50, le=250)
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2020)
    sex: Optional[Literal["male", "female", "other"]] = None
    goal_weight_kg: Optional[float] = Field(default=None, ge=20, le=300)


class ReportSaveRequest(BaseModel):
    report_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    report_type: Literal["daily", "weekly", "monthly"]
    prompt_used: str
    content: str
```

**注意**: `models.py` の先頭に `from typing import Literal` が既にあるか確認し、
なければ追加する（`Optional` は既存で `from typing import Optional` がある）。

---

## Step 4: `app/main.py` — 9エンドポイント追加

既存の `import` セクションに以下を追加:

```python
from .profile import get_profile, upsert_profile
from .reports import save_report, list_reports, get_report, delete_report
from .prompt_gen import build_prompt, calc_nutrient_targets
from .models import ProfileUpdateRequest, ReportSaveRequest
```

既存エンドポイントの後に追記:

```python
# ── プロフィール ──────────────────────────────────────────────

@app.get("/api/profile")
def profile_get(_: None = Depends(require_api_key)) -> dict:
    data = get_profile()
    return data if data is not None else {}


@app.put("/api/profile")
def profile_put(
    req: ProfileUpdateRequest,
    _: None = Depends(require_api_key),
) -> dict:
    return upsert_profile(**req.model_dump(exclude_none=True))


# ── サプリカタログ ────────────────────────────────────────────

@app.get("/api/supplements")
def supplements_get(_: None = Depends(require_api_key)) -> dict:
    from .nutrition import CATALOG
    return {
        "supplements": [
            {
                "alias": item.alias,
                "label": item.label,
                "kcal": item.kcal,
                "protein_g": item.protein_g,
                "fat_g": item.fat_g,
                "carbs_g": item.carbs_g,
            }
            for item in CATALOG.values()
        ]
    }


# ── AIプロンプト生成 ──────────────────────────────────────────

@app.get("/api/prompt")
def prompt_get(
    type: str = "daily",
    _: None = Depends(require_api_key),
) -> dict:
    if type not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="type must be daily | weekly | monthly")
    try:
        prompt = build_prompt(type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"type": type, "prompt": prompt}


# ── AIレポート CRUD ───────────────────────────────────────────

@app.post("/api/reports", status_code=201)
def reports_create(
    req: ReportSaveRequest,
    _: None = Depends(require_api_key),
) -> dict:
    return save_report(
        report_date=req.report_date,
        report_type=req.report_type,
        prompt_used=req.prompt_used,
        content=req.content,
    )


@app.get("/api/reports")
def reports_list(
    report_type: str | None = None,
    _: None = Depends(require_api_key),
) -> dict:
    return {"reports": list_reports(report_type=report_type)}


@app.get("/api/reports/{report_id}")
def reports_get(
    report_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    data = get_report(report_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return data


@app.delete("/api/reports/{report_id}")
def reports_delete(
    report_id: int,
    _: None = Depends(require_api_key),
) -> dict:
    ok = delete_report(report_id)
    return {"ok": ok, "deleted_id": report_id}


# ── 栄養素ターゲット ──────────────────────────────────────────

@app.get("/api/nutrients/targets")
def nutrients_targets(_: None = Depends(require_api_key)) -> dict:
    profile = get_profile()
    if profile is None:
        raise HTTPException(status_code=400, detail="プロフィール未設定。先に /api/profile を設定してください")
    height = profile.get("height_cm")
    birth_year = profile.get("birth_year")
    sex = profile.get("sex") or "male"
    if height is None or birth_year is None:
        raise HTTPException(status_code=400, detail="height_cm または birth_year が未設定です")

    # 最新体重を health_records から取得
    from .summary import build_summary
    summary = build_summary()
    weight_series = summary.get("weightByDate", [])
    latest_weight = 70.0  # fallback
    for x in reversed(weight_series):
        if x.get("kg") is not None:
            latest_weight = float(x["kg"])
            break

    targets = calc_nutrient_targets(
        height_cm=float(height),
        weight_kg=latest_weight,
        birth_year=int(birth_year),
        sex=sex,
    )
    return {"targets": targets}
```

---

## Step 5: `app/ui_template.html` — 全面改修

既存ファイルを**完全に置き換える**。
以下の構造で一から書き直す。

### 設計仕様

- `max-width: 430px` / `margin: 0 auto` でスマホサイズに固定
- 画面下部固定の5タブナビ（height: 64px）
- コンテンツエリアは `padding-bottom: 80px`（ナビに隠れないよう）
- 既存CSS変数を継承: `--bg: #09132a` / `--panel: #152847` / `--acc: #33ff20` 等
- CDN: Chart.js（既存）+ `marked.js@11`

### HTML骨格

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Health AI Advisor</title>
  <!-- 既存フォント -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&family=M+PLUS+1p:wght@400;700;800&display=swap" rel="stylesheet" />
  <!-- CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script>
  <style>
    /* ── CSS変数（既存テーマ継承） ── */
    :root {
      --bg: #09132a;
      --panel: #152847;
      --line: rgba(122, 153, 199, 0.22);
      --txt: #eaf2ff;
      --muted: #9fb3d8;
      --acc: #33ff20;
      --good: #85ff9f;
      --bad: #ff90a6;
      --warn: #ffc676;
      --nav-h: 64px;
    }
    /* ── リセット ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: "M PLUS 1p", sans-serif;
      color: var(--txt);
      background: radial-gradient(circle at 15% 0, #173569 0, #09132a 45%, #070e20 100%);
      /* スマホサイズ制限 */
    }
    #app {
      max-width: 430px;
      margin: 0 auto;
      min-height: 100vh;
      position: relative;
    }

    /* ── ビュー ── */
    .view { display: none; padding: 16px 12px calc(var(--nav-h) + 16px); }
    .view.active { display: block; }

    /* ── 底部ナビ ── */
    #bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 430px;
      height: var(--nav-h);
      background: rgba(15, 30, 58, 0.97);
      border-top: 1px solid var(--line);
      display: flex;
      z-index: 100;
    }
    #bottom-nav button {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--muted);
      font-family: inherit;
      font-size: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      transition: color 0.2s;
    }
    #bottom-nav button .icon { font-size: 22px; line-height: 1; }
    #bottom-nav button.active { color: var(--acc); }

    /* ── カード ── */
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .card-title { font-size: 11px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .08em; }
    .card-value { font-family: Lexend; font-size: 28px; font-weight: 700; color: var(--acc); }
    .card-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

    /* ── サブメニュー ── */
    .submenu { display: flex; gap: 8px; margin-bottom: 16px; }
    .submenu button {
      flex: 1;
      border: 1px solid var(--line);
      background: transparent;
      color: var(--muted);
      border-radius: 8px;
      padding: 8px 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .submenu button.active {
      background: var(--acc);
      color: #09132a;
      border-color: var(--acc);
      font-weight: 700;
    }
    .subview { display: none; }
    .subview.active { display: block; }

    /* ── 栄養素横棒グラフ ── */
    .nutrient-bar-wrap { display: grid; gap: 10px; }
    .nutrient-row { display: grid; grid-template-columns: 90px 1fr 80px; align-items: center; gap: 8px; }
    .nutrient-label { font-size: 12px; }
    .bar-track { height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
    .bar-fill.green { background: var(--acc); }
    .bar-fill.yellow { background: var(--warn); }
    .bar-fill.red { background: var(--bad); }
    .nutrient-val { font-size: 11px; color: var(--muted); text-align: right; }

    /* ── フォーム部品 ── */
    input, select, textarea {
      width: 100%;
      background: rgba(255,255,255,0.07);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--txt);
      padding: 10px 12px;
      font: inherit;
      font-size: 14px;
      margin-bottom: 10px;
    }
    textarea { resize: vertical; min-height: 120px; }
    .btn {
      display: block;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: var(--acc);
      color: #09132a;
      font: inherit;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      margin-bottom: 10px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .btn.secondary {
      background: transparent;
      border: 1px solid var(--acc);
      color: var(--acc);
    }
    .btn.danger {
      background: var(--bad);
      color: #09132a;
    }

    /* ── レポートカード ── */
    .report-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      cursor: pointer;
    }
    .report-card:hover { border-color: var(--acc); }
    .report-meta { font-size: 11px; color: var(--muted); margin-bottom: 6px; }
    .report-preview { font-size: 13px; line-height: 1.5; }
    .report-body { font-size: 14px; line-height: 1.7; }
    .report-body h1, .report-body h2, .report-body h3 { color: var(--acc); margin: 12px 0 6px; }
    .report-body p { margin-bottom: 8px; }

    /* ── チップ（badge） ── */
    .chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }
    .chip.daily { background: rgba(51,255,32,0.2); color: var(--acc); }
    .chip.weekly { background: rgba(255,198,118,0.2); color: var(--warn); }
    .chip.monthly { background: rgba(255,144,166,0.2); color: var(--bad); }

    /* ── セクション見出し ── */
    .section-title { font-size: 13px; font-weight: 700; color: var(--muted); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: .06em; }

    /* ── ローディング ── */
    .loading { text-align: center; color: var(--muted); padding: 20px; font-size: 13px; }
  </style>
</head>
<body>
<div id="app">

  <!-- ══════════════════════════════════════════
       🏠 ホーム
  ══════════════════════════════════════════ -->
  <div id="view-home" class="view active">
    <h2 style="font-size:18px;margin-bottom:16px;">今日のサマリー</h2>

    <div id="home-weight" class="card">
      <div class="card-title">⚖️ 体重</div>
      <div class="card-value" id="hw-val">--</div>
      <div class="card-sub" id="hw-sub">読み込み中...</div>
    </div>

    <div id="home-steps" class="card">
      <div class="card-title">👟 歩数</div>
      <div class="card-value" id="hs-val">--</div>
      <div class="card-sub" id="hs-sub">読み込み中...</div>
    </div>

    <div id="home-sleep" class="card">
      <div class="card-title">😴 睡眠（昨夜）</div>
      <div class="card-value" id="hsl-val">--</div>
      <div class="card-sub" id="hsl-sub">読み込み中...</div>
    </div>

    <div id="home-cal" class="card">
      <div class="card-title">🔥 カロリー収支</div>
      <div class="card-value" id="hc-val">--</div>
      <div class="card-sub" id="hc-sub">読み込み中...</div>
    </div>

    <div id="home-vitals" class="card">
      <div class="card-title">❤️ バイタル（最新）</div>
      <div id="hv-content" style="font-size:14px;line-height:2;">読み込み中...</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       🍽 食事
  ══════════════════════════════════════════ -->
  <div id="view-food" class="view">
    <div class="submenu">
      <button class="active" onclick="switchSub('food','food-log',this)">食事ログ</button>
      <button onclick="switchSub('food','food-suppl',this)">サプリ</button>
      <button onclick="switchSub('food','food-nutrients',this)">栄養素</button>
    </div>

    <!-- 食事ログ -->
    <div id="food-log" class="subview active">
      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
        <input type="date" id="food-date" style="margin:0;" />
        <button class="btn" style="width:auto;padding:10px 16px;margin:0;" onclick="loadFoodLog()">表示</button>
      </div>
      <div id="food-log-list"></div>

      <div class="section-title">追加</div>
      <input type="text" id="fl-label" placeholder="食品名" />
      <select id="fl-timing">
        <option value="08:00">朝食</option>
        <option value="12:00">昼食</option>
        <option value="19:00">夕食</option>
        <option value="15:00">間食</option>
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <input type="number" id="fl-kcal" placeholder="kcal" step="1" />
        <input type="number" id="fl-protein" placeholder="タンパク質(g)" step="0.1" />
        <input type="number" id="fl-fat" placeholder="脂質(g)" step="0.1" />
        <input type="number" id="fl-carbs" placeholder="炭水化物(g)" step="0.1" />
      </div>
      <button class="btn" onclick="addFoodLog()">追加する</button>
    </div>

    <!-- サプリ -->
    <div id="food-suppl" class="subview">
      <div class="section-title">今日のサプリチェック</div>
      <div id="suppl-list"></div>
    </div>

    <!-- 栄養素 -->
    <div id="food-nutrients" class="subview">
      <div class="section-title">今日の栄養素（目標比）</div>
      <div id="nutrient-bars" class="nutrient-bar-wrap"></div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       ❤️ 健康
  ══════════════════════════════════════════ -->
  <div id="view-health" class="view">
    <div class="submenu">
      <button class="active" onclick="switchSub('health','health-diet',this)">ダイエット</button>
      <button onclick="switchSub('health','health-activity',this)">活動</button>
      <button onclick="switchSub('health','health-vitals',this)">バイタル</button>
    </div>

    <!-- ダイエット -->
    <div id="health-diet" class="subview active">
      <div class="card">
        <div class="card-title">体重（30日）</div>
        <canvas id="chart-weight" height="180"></canvas>
      </div>
      <div class="card">
        <div class="card-title">体脂肪率</div>
        <canvas id="chart-bodyfat" height="140"></canvas>
      </div>
      <div class="card" id="diet-status-card">
        <div class="card-title">ダイエット状況</div>
        <div id="diet-status">読み込み中...</div>
      </div>
    </div>

    <!-- 活動 -->
    <div id="health-activity" class="subview">
      <div class="card">
        <div class="card-title">歩数（7日）</div>
        <canvas id="chart-steps" height="160"></canvas>
      </div>
      <div class="card">
        <div class="card-title">消費カロリー</div>
        <canvas id="chart-calories" height="160"></canvas>
      </div>
    </div>

    <!-- バイタル -->
    <div id="health-vitals" class="subview">
      <div class="card">
        <div class="card-title">安静時心拍（bpm）</div>
        <canvas id="chart-rhr" height="140"></canvas>
      </div>
      <div class="card">
        <div class="card-title">睡眠時間（時間）</div>
        <canvas id="chart-sleep" height="140"></canvas>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       🤖 AI
  ══════════════════════════════════════════ -->
  <div id="view-ai" class="view">
    <div class="submenu">
      <button class="active" onclick="switchSub('ai','ai-gen',this)">プロンプト生成</button>
      <button onclick="switchSub('ai','ai-save',this)">保存</button>
      <button onclick="switchSub('ai','ai-history',this)">履歴</button>
    </div>

    <!-- プロンプト生成 -->
    <div id="ai-gen" class="subview active">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="btn" style="background:var(--panel);color:var(--acc);border:1px solid var(--acc);" onclick="genPrompt('daily')">日次</button>
        <button class="btn" style="background:var(--panel);color:var(--warn);border:1px solid var(--warn);" onclick="genPrompt('weekly')">週次</button>
        <button class="btn" style="background:var(--panel);color:var(--bad);border:1px solid var(--bad);" onclick="genPrompt('monthly')">月次</button>
      </div>
      <textarea id="prompt-output" placeholder="「日次」「週次」「月次」ボタンを押してプロンプトを生成..." readonly></textarea>
      <button class="btn secondary" onclick="copyPrompt()">📋 コピーする</button>
      <p id="prompt-hint" style="font-size:12px;color:var(--muted);text-align:center;display:none;">
        ↑ コピーして Claude や ChatGPT に貼り付け、返答をこのアプリに保存できます
      </p>
    </div>

    <!-- レポート保存 -->
    <div id="ai-save" class="subview">
      <input type="date" id="save-date" />
      <select id="save-type">
        <option value="daily">日次レポート</option>
        <option value="weekly">週次レポート</option>
        <option value="monthly">月次レポート</option>
      </select>
      <textarea id="save-content" placeholder="LLMの返答をここに貼り付けてください..."></textarea>
      <button class="btn" onclick="saveReport()">レポートを保存</button>
    </div>

    <!-- 履歴 -->
    <div id="ai-history" class="subview">
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button class="btn secondary" style="font-size:12px;padding:8px;" onclick="loadHistory(null)">全て</button>
        <button class="btn secondary" style="font-size:12px;padding:8px;" onclick="loadHistory('daily')">日次</button>
        <button class="btn secondary" style="font-size:12px;padding:8px;" onclick="loadHistory('weekly')">週次</button>
        <button class="btn secondary" style="font-size:12px;padding:8px;" onclick="loadHistory('monthly')">月次</button>
      </div>
      <div id="history-list"></div>

      <!-- レポート詳細モーダル（インライン表示） -->
      <div id="report-detail" style="display:none;">
        <button class="btn secondary" onclick="closeDetail()">← 履歴に戻る</button>
        <div class="card">
          <div id="detail-meta" class="report-meta"></div>
          <div id="detail-body" class="report-body"></div>
        </div>
        <button class="btn danger" id="detail-delete-btn">削除する</button>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       ⚙️ 設定
  ══════════════════════════════════════════ -->
  <div id="view-settings" class="view">
    <div class="section-title">プロフィール</div>
    <div class="card">
      <input type="text" id="pf-name" placeholder="名前" />
      <input type="number" id="pf-height" placeholder="身長(cm)" step="0.1" />
      <input type="number" id="pf-birth-year" placeholder="生年（例: 1985）" step="1" />
      <select id="pf-sex">
        <option value="male">男性</option>
        <option value="female">女性</option>
        <option value="other">その他</option>
      </select>
      <input type="number" id="pf-goal-weight" placeholder="目標体重(kg)" step="0.1" />
      <button class="btn" onclick="saveProfile()">保存する</button>
      <p id="pf-result" style="font-size:12px;color:var(--acc);text-align:center;display:none;">✓ 保存しました</p>
    </div>

    <div class="section-title">サーバー</div>
    <div class="card">
      <div style="font-size:13px;color:var(--muted);">APIキー</div>
      <div id="api-key-display" style="font-family:monospace;font-size:12px;word-break:break-all;margin-top:4px;">（設定済み）</div>
      <div style="font-size:13px;color:var(--muted);margin-top:10px;">接続状態</div>
      <div id="conn-status" style="font-size:13px;margin-top:4px;">確認中...</div>
    </div>
  </div>

  <!-- 底部ナビ -->
  <nav id="bottom-nav">
    <button class="active" data-tab="home" onclick="switchTab('home',this)">
      <span class="icon">🏠</span><span>ホーム</span>
    </button>
    <button data-tab="food" onclick="switchTab('food',this)">
      <span class="icon">🍽</span><span>食事</span>
    </button>
    <button data-tab="health" onclick="switchTab('health',this)">
      <span class="icon">❤️</span><span>健康</span>
    </button>
    <button data-tab="ai" onclick="switchTab('ai',this)">
      <span class="icon">🤖</span><span>AI</span>
    </button>
    <button data-tab="settings" onclick="switchTab('settings',this)">
      <span class="icon">⚙️</span><span>設定</span>
    </button>
  </nav>
</div>

<script>
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  API クライアント
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// APIキーは URL パラメータ ?key=xxx または localStorage から取得
const API_KEY = new URLSearchParams(location.search).get('key')
  || localStorage.getItem('api_key') || '';
if (API_KEY) localStorage.setItem('api_key', API_KEY);

async function api(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ナビゲーション
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function switchTab(tab, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  btn.classList.add('active');
  onTabActivate(tab);
}

function switchSub(tabId, subId, btn) {
  const view = document.getElementById('view-' + tabId);
  view.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
  view.querySelectorAll('.submenu button').forEach(b => b.classList.remove('active'));
  document.getElementById(subId).classList.add('active');
  btn.classList.add('active');
  onSubActivate(subId);
}

// タブ切り替え時の初期ロード
function onTabActivate(tab) {
  if (tab === 'home') loadHome();
  if (tab === 'food') { initFoodDate(); loadFoodLog(); }
  if (tab === 'health') loadHealthCharts();
  if (tab === 'ai' ) loadHistory(null);
  if (tab === 'settings') loadSettings();
}

function onSubActivate(subId) {
  if (subId === 'food-suppl') loadSupplements();
  if (subId === 'food-nutrients') loadNutrientBars();
  if (subId === 'health-diet') loadHealthCharts();
  if (subId === 'ai-history') loadHistory(null);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🏠 ホーム
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadHome() {
  try {
    const s = await api('/api/summary');

    // 体重
    const wLast = s.weightByDate?.slice(-1)[0];
    document.getElementById('hw-val').textContent =
      wLast?.kg != null ? wLast.kg.toFixed(1) + ' kg' : '--';
    const diet = s.diet;
    document.getElementById('hw-sub').textContent =
      diet ? `トレンド: ${diet.trend} / MA7 Δ7d: ${diet.ma7Delta7d?.toFixed(2) ?? '--'} kg` : '';

    // 歩数
    const stLast = s.stepsByDate?.slice(-1)[0];
    document.getElementById('hs-val').textContent =
      stLast?.steps != null ? Math.round(stLast.steps).toLocaleString() + ' 歩' : '--';
    const stAvg = avg7(s.stepsByDate, 'steps');
    document.getElementById('hs-sub').textContent =
      stAvg != null ? `7日平均: ${Math.round(stAvg).toLocaleString()} 歩` : '';

    // 睡眠（昨夜）
    const slLast = s.sleepHoursByDate?.slice(-1)[0];
    document.getElementById('hsl-val').textContent =
      slLast?.hours != null ? slLast.hours.toFixed(1) + ' h' : '--';
    document.getElementById('hsl-sub').textContent = slLast?.date ?? '';

    // カロリー収支
    const cbLast = s.calorieBalanceByDate?.slice(-1)[0];
    const cbVal = cbLast?.kcal;
    const el = document.getElementById('hc-val');
    el.textContent = cbVal != null ? (cbVal > 0 ? '+' : '') + Math.round(cbVal) + ' kcal' : '--';
    el.style.color = cbVal == null ? 'var(--txt)' : cbVal > 200 ? 'var(--bad)' : cbVal < -200 ? 'var(--good)' : 'var(--warn)';
    document.getElementById('hc-sub').textContent = cbVal != null ? '摂取 - 消費' : '食事記録または消費データなし';

    // バイタル
    const rhrLast = s.restingHeartRateBpmByDate?.slice(-1)[0];
    const spo2Last = s.oxygenSaturationPctByDate?.slice(-1)[0];
    document.getElementById('hv-content').innerHTML = [
      rhrLast?.bpm != null ? `安静時心拍: <b>${Math.round(rhrLast.bpm)} bpm</b>` : null,
      spo2Last?.pct != null ? `SpO2: <b>${spo2Last.pct.toFixed(1)} %</b>` : null,
    ].filter(Boolean).join('<br>') || 'データなし';
  } catch (e) {
    console.error('loadHome error:', e);
  }
}

function avg7(series, key) {
  if (!series?.length) return null;
  const tail = series.slice(-7).map(x => x[key]).filter(v => v != null);
  return tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🍽 食事ログ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initFoodDate() {
  document.getElementById('food-date').value = todayStr();
}

function todayStr() {
  return new Date().toLocaleDateString('sv-SE');
}

async function loadFoodLog() {
  const date = document.getElementById('food-date').value || todayStr();
  const el = document.getElementById('food-log-list');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const data = await api(`/api/nutrition/day?date=${date}`);
    if (!data.events?.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:13px;">記録なし</p>';
      return;
    }
    el.innerHTML = data.events.map(e => `
      <div class="card" style="padding:10px;">
        <div style="font-size:14px;font-weight:700;">${e.label}</div>
        <div style="font-size:12px;color:var(--muted);">
          ${[e.kcal && e.kcal + 'kcal', e.protein_g && 'P' + e.protein_g + 'g',
             e.fat_g && 'F' + e.fat_g + 'g', e.carbs_g && 'C' + e.carbs_g + 'g']
            .filter(Boolean).join(' / ') || '栄養素未入力'}
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<p style="color:var(--bad);">読み込みエラー</p>';
  }
}

async function addFoodLog() {
  const date = document.getElementById('food-date').value || todayStr();
  const time = document.getElementById('fl-timing').value;
  const label = document.getElementById('fl-label').value.trim();
  if (!label) { alert('食品名を入力してください'); return; }

  const payload = {
    label,
    consumed_at: date + 'T' + time + ':00',
    kcal: parseFloat(document.getElementById('fl-kcal').value) || null,
    protein_g: parseFloat(document.getElementById('fl-protein').value) || null,
    fat_g: parseFloat(document.getElementById('fl-fat').value) || null,
    carbs_g: parseFloat(document.getElementById('fl-carbs').value) || null,
  };
  try {
    await api('/api/nutrition/log', { method: 'POST', body: payload });
    document.getElementById('fl-label').value = '';
    loadFoodLog();
  } catch (e) {
    alert('追加に失敗しました: ' + e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  サプリ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadSupplements() {
  const el = document.getElementById('suppl-list');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const [suppls, dayData] = await Promise.all([
      api('/api/supplements'),
      api(`/api/nutrition/day?date=${todayStr()}`),
    ]);
    const checkedAliases = new Set(
      (dayData.events || []).map(e => e.alias).filter(Boolean)
    );
    el.innerHTML = suppls.supplements.map(s => {
      const checked = checkedAliases.has(s.alias);
      return `
        <div class="card" style="padding:10px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:22px;">${checked ? '✅' : '⬜'}</span>
          <div style="flex:1;">
            <div style="font-size:13px;">${s.label}</div>
          </div>
          ${!checked ? `<button class="btn" style="width:auto;padding:8px 12px;margin:0;font-size:12px;" onclick="logSuppl('${s.alias}')">チェック</button>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = '<p style="color:var(--bad);">読み込みエラー</p>';
  }
}

async function logSuppl(alias) {
  try {
    await api('/api/nutrition/log', { method: 'POST', body: { alias, count: 1 } });
    loadSupplements();
  } catch (e) {
    alert('ログ追加エラー: ' + e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  栄養素横棒グラフ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadNutrientBars() {
  const el = document.getElementById('nutrient-bars');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const data = await api('/api/nutrients/targets');
    const targets = data.targets;
    el.innerHTML = targets.map(t => {
      const pct = t.target > 0 && t.actual != null
        ? Math.min(100, Math.round((t.actual / t.target) * 100))
        : 0;
      const actualText = t.actual != null
        ? `${t.actual.toFixed(1)} / ${t.target}${t.unit}`
        : `-- / ${t.target}${t.unit}`;
      return `
        <div class="nutrient-row">
          <div class="nutrient-label">${t.name}</div>
          <div class="bar-track">
            <div class="bar-fill ${t.status}" style="width:${pct}%;"></div>
          </div>
          <div class="nutrient-val">${actualText}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = `<p style="color:var(--bad);">${e.message}</p>`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ❤️ 健康チャート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const chartInstances = {};

function mkChart(id, type, labels, datasets, opts = {}) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  chartInstances[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: datasets.length > 1, labels: { color: '#9fb3d8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9fb3d8', font: { size: 10 }, maxTicksLimit: 7 }, grid: { color: 'rgba(122,153,199,0.1)' } },
        y: { ticks: { color: '#9fb3d8', font: { size: 10 } }, grid: { color: 'rgba(122,153,199,0.1)' } },
      },
      ...opts,
    },
  });
}

async function loadHealthCharts() {
  try {
    const s = await api('/api/summary');

    // 体重（30日）
    const w30 = (s.weightByDate || []).slice(-30);
    mkChart('chart-weight', 'line',
      w30.map(x => x.date.slice(5)),
      [{
        label: '体重 (kg)',
        data: w30.map(x => x.kg),
        borderColor: '#33ff20',
        backgroundColor: 'rgba(51,255,32,0.1)',
        tension: 0.3,
        spanGaps: true,
      }]
    );

    // 体脂肪
    const bf = (s.bodyFatPctByDate || []).slice(-30);
    mkChart('chart-bodyfat', 'line',
      bf.map(x => x.date.slice(5)),
      [{
        label: '体脂肪率 (%)',
        data: bf.map(x => x.pct),
        borderColor: '#ffc676',
        backgroundColor: 'rgba(255,198,118,0.1)',
        tension: 0.3,
        spanGaps: true,
      }]
    );

    // ダイエット状況テキスト
    const diet = s.diet;
    if (diet) {
      const trendMap = { gain: '増加中', plateau: '停滞', slow_loss: 'ゆるやか減量', loss: '減量中', unknown: '不明' };
      document.getElementById('diet-status').innerHTML = `
        <div style="font-size:15px;font-weight:700;color:var(--acc);">${trendMap[diet.trend] ?? diet.trend}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;">
          MA7 Δ7d: ${diet.ma7Delta7d?.toFixed(2) ?? '--'} kg<br>
          推定赤字: ${diet.estimatedDeficitKcalPerDay?.toFixed(0) ?? '--'} kcal/日
        </div>
      `;
    }

    // 歩数（7日）
    const st7 = (s.stepsByDate || []).slice(-7);
    mkChart('chart-steps', 'bar',
      st7.map(x => x.date.slice(5)),
      [{ label: '歩数', data: st7.map(x => x.steps), backgroundColor: 'rgba(51,255,32,0.5)' }]
    );

    // 消費カロリー（7日）
    const act7 = (s.activeCaloriesByDate || []).slice(-7);
    const tot7 = (s.totalCaloriesByDate || []).slice(-7);
    // 共通ラベルを作成
    const calLabels = [...new Set([...act7.map(x => x.date), ...tot7.map(x => x.date)])].sort().slice(-7);
    const actMap = Object.fromEntries((s.activeCaloriesByDate || []).map(x => [x.date, x.kcal]));
    const totMap = Object.fromEntries((s.totalCaloriesByDate || []).map(x => [x.date, x.kcal]));
    mkChart('chart-calories', 'line',
      calLabels.map(d => d.slice(5)),
      [
        { label: '活動カロリー', data: calLabels.map(d => actMap[d] ?? null), borderColor: '#ffc676', tension: 0.3, spanGaps: true },
        { label: '総消費', data: calLabels.map(d => totMap[d] ?? null), borderColor: '#ff90a6', tension: 0.3, spanGaps: true },
      ]
    );

    // 安静時心拍
    const rhr = (s.restingHeartRateBpmByDate || []).slice(-14);
    mkChart('chart-rhr', 'line',
      rhr.map(x => x.date.slice(5)),
      [{ label: '安静時心拍', data: rhr.map(x => x.bpm), borderColor: '#ff90a6', tension: 0.3, spanGaps: true }]
    );

    // 睡眠
    const sleep = (s.sleepHoursByDate || []).slice(-14);
    mkChart('chart-sleep', 'bar',
      sleep.map(x => x.date.slice(5)),
      [{ label: '睡眠時間', data: sleep.map(x => x.hours), backgroundColor: 'rgba(122,153,199,0.5)' }]
    );
  } catch (e) {
    console.error('loadHealthCharts error:', e);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🤖 AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _lastPrompt = '';
let _lastPromptType = 'daily';

async function genPrompt(type) {
  const ta = document.getElementById('prompt-output');
  ta.value = '生成中...';
  try {
    const data = await api(`/api/prompt?type=${type}`);
    ta.value = data.prompt;
    _lastPrompt = data.prompt;
    _lastPromptType = type;
    document.getElementById('prompt-hint').style.display = 'block';
  } catch (e) {
    ta.value = 'エラー: ' + e.message;
  }
}

async function copyPrompt() {
  const text = document.getElementById('prompt-output').value;
  if (!text || text === '生成中...') return;
  try {
    await navigator.clipboard.writeText(text);
    alert('コピーしました！');
  } catch {
    // フォールバック: textareaを選択してCtrl+Cを促す
    document.getElementById('prompt-output').select();
    alert('テキストを選択しました。Ctrl+C でコピーしてください');
  }
}

async function saveReport() {
  const date = document.getElementById('save-date').value || todayStr();
  const type = document.getElementById('save-type').value;
  const content = document.getElementById('save-content').value.trim();
  if (!content) { alert('レポート内容を貼り付けてください'); return; }

  try {
    await api('/api/reports', {
      method: 'POST',
      body: {
        report_date: date,
        report_type: type,
        prompt_used: _lastPrompt || '（プロンプト未保存）',
        content,
      },
    });
    document.getElementById('save-content').value = '';
    alert('保存しました！');
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}

async function loadHistory(filterType) {
  const el = document.getElementById('history-list');
  const detail = document.getElementById('report-detail');
  el.style.display = 'block';
  detail.style.display = 'none';
  el.innerHTML = '<div class="loading">読み込み中...</div>';

  try {
    const url = filterType ? `/api/reports?report_type=${filterType}` : '/api/reports';
    const data = await api(url);
    if (!data.reports?.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:13px;">レポートなし</p>';
      return;
    }
    el.innerHTML = data.reports.map(r => `
      <div class="report-card" onclick="showDetail(${r.id})">
        <div class="report-meta">
          ${r.report_date} &nbsp;
          <span class="chip ${r.report_type}">${r.report_type === 'daily' ? '日次' : r.report_type === 'weekly' ? '週次' : '月次'}</span>
        </div>
        <div class="report-preview">${escHtml(r.preview ?? '')}${(r.preview?.length >= 200) ? '...' : ''}</div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<p style="color:var(--bad);">読み込みエラー: ' + e.message + '</p>';
  }
}

let _detailId = null;

async function showDetail(id) {
  _detailId = id;
  document.getElementById('history-list').style.display = 'none';
  const detail = document.getElementById('report-detail');
  detail.style.display = 'block';
  document.getElementById('detail-body').innerHTML = '<div class="loading">読み込み中...</div>';
  try {
    const r = await api(`/api/reports/${id}`);
    document.getElementById('detail-meta').textContent = `${r.report_date} / ${r.report_type}`;
    document.getElementById('detail-body').innerHTML = marked.parse(r.content ?? '');
    document.getElementById('detail-delete-btn').onclick = () => deleteReport(id);
  } catch (e) {
    document.getElementById('detail-body').innerHTML = '<p style="color:var(--bad);">読み込みエラー</p>';
  }
}

function closeDetail() {
  document.getElementById('history-list').style.display = 'block';
  document.getElementById('report-detail').style.display = 'none';
}

async function deleteReport(id) {
  if (!confirm('このレポートを削除しますか？')) return;
  try {
    await api(`/api/reports/${id}`, { method: 'DELETE' });
    closeDetail();
    loadHistory(null);
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ⚙️ 設定
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadSettings() {
  try {
    const p = await api('/api/profile');
    if (p.name) document.getElementById('pf-name').value = p.name;
    if (p.height_cm) document.getElementById('pf-height').value = p.height_cm;
    if (p.birth_year) document.getElementById('pf-birth-year').value = p.birth_year;
    if (p.sex) document.getElementById('pf-sex').value = p.sex;
    if (p.goal_weight_kg) document.getElementById('pf-goal-weight').value = p.goal_weight_kg;
  } catch {}

  // 接続確認
  try {
    const st = await api('/api/status');
    document.getElementById('conn-status').textContent =
      `✅ 接続OK（レコード ${st.totalRecords} 件）`;
    document.getElementById('conn-status').style.color = 'var(--good)';
  } catch {
    document.getElementById('conn-status').textContent = '❌ 接続失敗';
    document.getElementById('conn-status').style.color = 'var(--bad)';
  }
}

async function saveProfile() {
  const body = {};
  const name = document.getElementById('pf-name').value.trim();
  const height = parseFloat(document.getElementById('pf-height').value);
  const birth = parseInt(document.getElementById('pf-birth-year').value);
  const sex = document.getElementById('pf-sex').value;
  const goal = parseFloat(document.getElementById('pf-goal-weight').value);

  if (name) body.name = name;
  if (!isNaN(height)) body.height_cm = height;
  if (!isNaN(birth)) body.birth_year = birth;
  body.sex = sex;
  if (!isNaN(goal)) body.goal_weight_kg = goal;

  try {
    await api('/api/profile', { method: 'PUT', body });
    const r = document.getElementById('pf-result');
    r.style.display = 'block';
    setTimeout(() => { r.style.display = 'none'; }, 2000);
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  初期化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 保存日付の初期値
document.getElementById('save-date').value = todayStr();
document.getElementById('food-date').value = todayStr();

// 初回ロード
loadHome();
</script>
</body>
</html>
```

---

## Step 6: テスト作成 (`tests/`)

### テストの書き方（既存パターン）

```python
# tests/test_profile.py の例

from __future__ import annotations

import os
import tempfile
import unittest

# テスト用DBパスを設定（importより前に行う）
_tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
_tmp.close()
os.environ['DB_PATH'] = _tmp.name

from app.db import init_db
from app.profile import get_profile, upsert_profile


class ProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        init_db()

    def test_get_profile_returns_none_when_empty(self) -> None:
        result = get_profile()
        self.assertIsNone(result)

    def test_upsert_creates_profile(self) -> None:
        result = upsert_profile(name='テスト', height_cm=172.0, birth_year=1985, sex='male', goal_weight_kg=75.0)
        self.assertEqual(result['name'], 'テスト')
        self.assertEqual(result['height_cm'], 172.0)

    def test_upsert_partial_update(self) -> None:
        upsert_profile(name='初期', height_cm=170.0, birth_year=1990, sex='male', goal_weight_kg=70.0)
        result = upsert_profile(goal_weight_kg=65.0)  # goal_weight_kgだけ更新
        self.assertEqual(result['name'], '初期')        # 既存値を保持
        self.assertEqual(result['goal_weight_kg'], 65.0)

    def test_get_profile_after_upsert(self) -> None:
        upsert_profile(name='確認用', height_cm=165.0, birth_year=1995, sex='female')
        result = get_profile()
        self.assertIsNotNone(result)
        self.assertEqual(result['sex'], 'female')


if __name__ == '__main__':
    unittest.main()
```

同様のパターンで以下を作成:

- **`tests/test_reports.py`**: `save_report` → 保存・取得・削除・リスト・filterのテスト
- **`tests/test_prompt_gen.py`**: `build_prompt('daily')` が文字列を返す / 不正タイプで ValueError
- **`tests/test_nutrients.py`**: `calc_nutrient_targets` の返り値の構造確認・Harris-Benedict 計算（172cm/83kg/男性/1985年生 → BMR ≈ 1877kcal）

---

## 実行確認コマンド

```bash
# サーバー起動（pc-server ディレクトリから）
cd pc-server
uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload

# テスト
python -m pytest tests/ -v

# APIキー付きでUI確認
# ブラウザで: http://localhost:8765/ui?key=<YOUR_API_KEY>
```

---

## 注意事項・落とし穴

| 項目 | 内容 |
|---|---|
| `Literal` のimport | `models.py` に `from typing import Literal` がなければ追加する |
| `models.py` の既存import | `Optional`, `Field`, `BaseModel` は既に import 済みなので重複しない |
| `main.py` の import 追加 | 既存の from .models import ... の行に追記（別行でも可） |
| DB パス | テストでは必ず `os.environ['DB_PATH'] = <temp>` を `import app` より前に設定する |
| `ui_template.html` | 既存ファイルを**完全に置き換え**。既存コードをマージしない |
| `navigator.clipboard` | localhost はOK。IP経由アクセス時はHTTPSが必要。fallback実装済み |
| `init_db()` の呼び出し | `app.on_event("startup")` で既に呼ばれているのでテスト以外は手動不要 |
| `build_summary()` のコスト | プロンプト生成時に1回呼ぶだけ。ループ内で呼ばない |
