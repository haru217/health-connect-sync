# Iteration 1b — Codex 用指示書（/api/home-summary 拡張）

## 背景

ホーム画面のリデザインに伴い、`/api/home-summary` のレスポンス構造を変更します。

**主な変更:**
1. `sufficiency` に各データの値（`sleep_value`, `steps_value` 等）を追加
2. `attention_points` 配列を追加（ルールベース、LLM不使用）
3. `evidences` 配列を廃止

---

## 対象ファイル

`pc-server/app/main.py` のみ変更してください。

---

## Step 1: `/api/home-summary` のレスポンス構造変更

### 新しいレスポンス例

```json
{
  "date": "2026-02-25",
  "report": null,
  "sufficiency": {
    "sleep": true,
    "sleep_value": "6h32m",
    "steps": true,
    "steps_value": "3,200",
    "weight": true,
    "weight_value": "72.3kg",
    "meal": false,
    "meal_value": null,
    "blood_pressure": true,
    "blood_pressure_value": "120/78",
    "blood_pressure_warning": false
  },
  "attention_points": [
    {
      "id": "sleep_deficit_streak_2026-02-25",
      "icon": "⚠️",
      "message": "睡眠不足が3日連続しています",
      "severity": "warning",
      "category": "trend",
      "navigate_to": { "tab": "health", "sub_tab": "sleep" }
    }
  ]
}
```

**廃止:** `evidences` フィールドは返さない。

---

## Step 2: `home_summary()` 関数の修正

既存の `home_summary()` 関数を以下の方針で書き換えてください。

### 2-1. sufficiency の値取得を追加

既存のクエリに加えて、以下のデータを取得します：

**睡眠時間の整形（既存ロジックをそのまま流用）:**
```python
sleep_value = None
if sleep_session:
    try:
        s = _datetime.fromisoformat(sleep_session["start_time"].replace("Z", "+00:00"))
        e = _datetime.fromisoformat(sleep_session["end_time"].replace("Z", "+00:00"))
        total_min = int((e - s).total_seconds() / 60)
        h, m = divmod(total_min, 60)
        sleep_value = f"{h}h{m}m"
    except Exception:
        pass
```

**歩数の整形（既存 steps_label ロジックを流用）:**
```python
steps_value = f"{int(steps_val):,}" if steps_val else None
```

**体重の整形（既存 weight_label ロジックを流用）:**
```python
weight_value = weight_label  # 既存の "72.3kg" 形式をそのまま使う
```

**食事のkcal（新規）:**
```python
# nutrition_events から当日の合計kcal
meal_kcal_row = conn.execute(
    """SELECT SUM(CAST(json_extract(payload_json,'$.energy.inKilocalories') AS REAL)) AS kcal
       FROM health_records
       WHERE type='NutritionRecord' AND date(time) = ?""",
    (date,),
).fetchone()
# nutrition_events テーブルでも試みる
if not (meal_kcal_row and meal_kcal_row["kcal"]):
    meal_kcal_row2 = conn.execute(
        "SELECT SUM(kcal) AS kcal FROM nutrition_events WHERE local_date = ?",
        (date,),
    ).fetchone()
    meal_kcal = meal_kcal_row2["kcal"] if meal_kcal_row2 and meal_kcal_row2["kcal"] else None
else:
    meal_kcal = meal_kcal_row["kcal"]

meal_value = f"{int(meal_kcal):,}kcal" if meal_kcal else None
```

**血圧（新規）:**
```python
bp_row = conn.execute(
    """SELECT json_extract(payload_json,'$.systolic.inMillimetersOfMercury') AS systolic,
              json_extract(payload_json,'$.diastolic.inMillimetersOfMercury') AS diastolic
       FROM health_records
       WHERE type='BloodPressureRecord' AND date(time) = ?
       ORDER BY time DESC LIMIT 1""",
    (date,),
).fetchone()
bp_systolic = float(bp_row["systolic"]) if bp_row and bp_row["systolic"] else None
bp_diastolic = float(bp_row["diastolic"]) if bp_row and bp_row["diastolic"] else None
blood_pressure_value = f"{int(bp_systolic)}/{int(bp_diastolic)}" if bp_systolic and bp_diastolic else None
blood_pressure_ok = blood_pressure_value is not None
blood_pressure_warning = bool(
    bp_systolic and bp_diastolic and (bp_systolic >= 130 or bp_diastolic >= 85)
)
```

### 2-2. attention_points の生成

`home_summary()` 関数内で、以下のルールベースロジックを実装してください。
**LLMは使いません。全てSQLで集計し、Pythonで閾値判定します。**

```python
attention_points = []

# ── カテゴリ1: 閾値ベース（血圧）
if bp_systolic and bp_diastolic:
    if bp_systolic >= 140 or bp_diastolic >= 90:
        attention_points.append({
            "id": f"bp_critical_{date}",
            "icon": "🔴",
            "message": f"血圧が高めです（{int(bp_systolic)}/{int(bp_diastolic)} mmHg）。継続する場合は医療機関への相談を推奨します",
            "severity": "critical",
            "category": "threshold",
            "navigate_to": {"tab": "health", "sub_tab": "vital"},
        })
    elif bp_systolic >= 130 or bp_diastolic >= 85:
        attention_points.append({
            "id": f"bp_warning_{date}",
            "icon": "⚠️",
            "message": f"血圧がやや高めです（{int(bp_systolic)}/{int(bp_diastolic)} mmHg）",
            "severity": "warning",
            "category": "threshold",
            "navigate_to": {"tab": "health", "sub_tab": "vital"},
        })
```

```python
# ── カテゴリ1: 閾値ベース（SpO2）
spo2_row = conn.execute(
    """SELECT AVG(CAST(json_extract(payload_json,'$.percentage') AS REAL)) AS avg_spo2
       FROM health_records
       WHERE type='OxygenSaturationRecord' AND date(time) = ?""",
    (date,),
).fetchone()
spo2 = spo2_row["avg_spo2"] if spo2_row and spo2_row["avg_spo2"] else None

if spo2 is not None:
    if spo2 < 90:
        attention_points.insert(0, {  # 最優先
            "id": f"spo2_critical_{date}",
            "icon": "🔴",
            "message": f"酸素飽和度が著しく低下しています（{spo2:.1f}%）。速やかに医療機関に相談してください",
            "severity": "critical",
            "category": "threshold",
            "navigate_to": {"tab": "health", "sub_tab": "sleep"},
        })
    elif spo2 < 95:
        attention_points.append({
            "id": f"spo2_warning_{date}",
            "icon": "⚠️",
            "message": f"酸素飽和度が低下しています（{spo2:.1f}%）。継続する場合は医療機関への相談を推奨します",
            "severity": "critical",
            "category": "threshold",
            "navigate_to": {"tab": "health", "sub_tab": "sleep"},
        })
```

```python
# ── カテゴリ2: トレンドベース（睡眠不足の連続）
# 直近3日（基準日含む）の睡眠時間を取得
import datetime as _dt_ap
base_date = _dt_ap.date.fromisoformat(date)
sleep_deficit_days = 0
SLEEP_GOAL_MIN = 420  # 7時間（ユーザー設定が取れない場合のデフォルト）

# user_profile から睡眠目標を取得（カラムが存在する場合）
try:
    goal_row = conn.execute(
        "SELECT sleep_goal_minutes FROM user_profile LIMIT 1"
    ).fetchone()
    if goal_row and goal_row["sleep_goal_minutes"]:
        SLEEP_GOAL_MIN = int(goal_row["sleep_goal_minutes"])
except Exception:
    pass

for i in range(3):
    d = (base_date - _dt_ap.timedelta(days=i)).isoformat()
    row = conn.execute(
        """SELECT start_time, end_time FROM health_records
           WHERE type='SleepSessionRecord' AND date(end_time) = ?
           ORDER BY start_time DESC LIMIT 1""",
        (d,),
    ).fetchone()
    if row:
        try:
            s = _datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
            e = _datetime.fromisoformat(row["end_time"].replace("Z", "+00:00"))
            dur_min = int((e - s).total_seconds() / 60)
            if dur_min < SLEEP_GOAL_MIN * 0.7:
                sleep_deficit_days += 1
        except Exception:
            pass
    # データなしの日は不足としてカウントしない

if sleep_deficit_days >= 3:
    attention_points.append({
        "id": f"sleep_deficit_streak_{date}",
        "icon": "⚠️",
        "message": "睡眠不足が3日連続しています",
        "severity": "warning",
        "category": "trend",
        "navigate_to": {"tab": "health", "sub_tab": "sleep"},
    })
```

```python
# ── カテゴリ2: トレンドベース（体重の増減トレンド）
# 直近7日と前7日の平均体重を比較
try:
    week_avg = conn.execute(
        """SELECT AVG(CAST(json_extract(payload_json,'$.weight.inKilograms') AS REAL)) AS avg
           FROM health_records
           WHERE type='WeightRecord'
             AND date(time) BETWEEN date(?, '-6 days') AND ?""",
        (date, date),
    ).fetchone()
    prev_avg = conn.execute(
        """SELECT AVG(CAST(json_extract(payload_json,'$.weight.inKilograms') AS REAL)) AS avg
           FROM health_records
           WHERE type='WeightRecord'
             AND date(time) BETWEEN date(?, '-13 days') AND date(?, '-7 days')""",
        (date, date),
    ).fetchone()

    w_cur = week_avg["avg"] if week_avg and week_avg["avg"] else None
    w_prev = prev_avg["avg"] if prev_avg and prev_avg["avg"] else None

    if w_cur and w_prev:
        diff = w_cur - w_prev
        # 目標が減量の場合
        goal_row2 = conn.execute(
            "SELECT goal_weight_kg FROM user_profile LIMIT 1"
        ).fetchone()
        has_goal = goal_row2 and goal_row2["goal_weight_kg"]

        if diff <= -0.3:
            attention_points.append({
                "id": f"weight_trend_down_{date}",
                "icon": "📉",
                "message": f"体重が先週比 -{abs(diff):.1f}kg、減量ペース維持中",
                "severity": "positive",
                "category": "trend",
                "navigate_to": {"tab": "health", "sub_tab": "composition"},
            })
        elif diff >= 0.5 and has_goal:
            attention_points.append({
                "id": f"weight_trend_up_{date}",
                "icon": "📈",
                "message": f"体重が先週比 +{diff:.1f}kg。食事と活動量を確認しましょう",
                "severity": "info",
                "category": "trend",
                "navigate_to": {"tab": "health", "sub_tab": "composition"},
            })
except Exception:
    pass
```

```python
# ── カテゴリ3: 達成ベース（歩数目標 3日連続）
try:
    goal_steps_row = conn.execute(
        "SELECT steps_goal FROM user_profile LIMIT 1"
    ).fetchone()
    STEPS_GOAL = int(goal_steps_row["steps_goal"]) if goal_steps_row and goal_steps_row["steps_goal"] else 8000

    streak = 0
    for i in range(3):
        d = (base_date - _dt_ap.timedelta(days=i)).isoformat()
        s_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.count') AS REAL)) AS steps
               FROM health_records WHERE type='StepsRecord' AND date(start_time) = ?""",
            (d,),
        ).fetchone()
        if s_row and s_row["steps"] and s_row["steps"] >= STEPS_GOAL:
            streak += 1
        else:
            break  # 連続が途切れた
    if streak >= 3:
        attention_points.append({
            "id": f"steps_streak_{date}",
            "icon": "📈",
            "message": f"歩数目標を{streak}日連続達成中！",
            "severity": "positive",
            "category": "achievement",
            "navigate_to": {"tab": "exercise"},
        })
except Exception:
    pass
```

```python
# ── ソート: severity 順（critical > warning > info > positive）
SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2, "positive": 3}
attention_points.sort(key=lambda p: SEVERITY_ORDER.get(p["severity"], 99))

# 重複排除: 同一カテゴリ（血圧等）で severity が高いものを残す
seen_data_sources = {}
deduped = []
for p in attention_points:
    key = p["id"].rsplit("_", 1)[0]  # "bp_critical_2026-02-25" → "bp_critical"
    data_type = key.rsplit("_", 1)[0]  # "bp_critical" → "bp"
    if data_type not in seen_data_sources:
        seen_data_sources[data_type] = True
        deduped.append(p)
attention_points = deduped
```

### 2-3. 戻り値の変更

```python
return {
    "date": date,
    "report": (
        {"content": report_row["content"], "created_at": report_row["created_at"]}
        if report_row else None
    ),
    "sufficiency": {
        "sleep": sleep_ok,
        "sleep_value": sleep_value,
        "steps": steps_ok,
        "steps_value": steps_value,
        "weight": weight_ok,
        "weight_value": weight_value,
        "meal": meal_ok,
        "meal_value": meal_value,
        "blood_pressure": blood_pressure_ok,
        "blood_pressure_value": blood_pressure_value,
        "blood_pressure_warning": blood_pressure_warning,
    },
    "attention_points": attention_points,
}
```

**`evidences` キーは返さないでください。**

---

## 注意事項

- `with db() as conn:` ブロックは1つにまとめる（SQLiteの接続を複数開かない）
- `attention_points` 生成中に例外が出ても 500 エラーにしない → 各ブロックを `try/except` で囲む
- `user_profile` に `steps_goal` / `sleep_goal_minutes` カラムがない場合はデフォルト値を使う
- DB は読み取り専用（SELECT のみ）
- `_datetime` は関数内 `from datetime import datetime as _datetime` でローカルインポート済みのものを使う
- `_dt_ap` は `import datetime as _dt_ap` として関数内でローカルインポートする（既存の `_dt`, `_dt2`, `_dt3` と被らないように）

---

## 動作確認

```bash
BASE="http://localhost:8765"
KEY="<VITE_API_KEY の値>"

curl -s -H "X-Api-Key: $KEY" "$BASE/api/home-summary?date=2026-02-25" | python -m json.tool
```

確認ポイント：
- `sufficiency.sleep_value` 等に値が入っていること
- `attention_points` が配列で返ること（0件でも `[]`）
- `evidences` キーが存在しないこと
