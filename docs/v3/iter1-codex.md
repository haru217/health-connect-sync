# Iteration 1 — Codex 用指示書（/api/home-summary エンドポイント追加）

## 背景・前提

Health AI Advisor v3 の Iteration 1 バックエンドです。

**対象ファイル：** `pc-server/app/main.py`（末尾に追記するだけ）

既存コードは変更しません。

---

## 追加するエンドポイント

```
GET /api/home-summary?date=YYYY-MM-DD
```

**用途：** ホーム画面専用の軽量エンドポイント。AIレポート + データ充足フラグ + 根拠データリストを返す。

**レスポンス例：**
```json
{
  "date": "2026-02-25",
  "report": {
    "content": "<!--DOCTOR-->...",
    "created_at": "2026-02-25T10:00:00+00:00"
  },
  "sufficiency": {
    "sleep": true,
    "steps": true,
    "weight": false,
    "meal": true
  },
  "evidences": [
    { "type": "sleep", "label": "睡眠", "value": "6時間32分", "tab": "health", "innerTab": "sleep" },
    { "type": "steps", "label": "歩数", "value": "3,200歩", "tab": "exercise" },
    { "type": "meal", "label": "食事", "value": "3件", "tab": "meal" }
  ]
}
```

---

## 実装コード

`main.py` の末尾（最後の空行の前）に以下を追加してください：

```python
@app.get("/api/home-summary")
def home_summary(
    date: str | None = None,
    _: None = Depends(require_api_key),
) -> dict[str, Any]:
    """ホーム画面専用の軽量エンドポイント。

    AI レポート（当日分）+ データ充足フラグ + 根拠データリストを返す。
    """
    import datetime as _dt3
    if date is None:
        date = _dt3.date.today().isoformat()
    else:
        try:
            _dt3.date.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date は YYYY-MM-DD 形式") from exc

    with db() as conn:
        # ── AI レポート（当日の daily レポート）
        report_row = conn.execute(
            """SELECT content, created_at FROM ai_reports
               WHERE report_date = ? AND report_type = 'daily'
               ORDER BY created_at DESC LIMIT 1""",
            (date,),
        ).fetchone()

        # ── データ充足チェック（当日データの存在確認）
        sleep_row = conn.execute(
            """SELECT COUNT(*) AS c FROM health_records
               WHERE type='SleepSessionRecord' AND date(start_time) = ?""",
            (date,),
        ).fetchone()

        steps_row = conn.execute(
            """SELECT SUM(CAST(json_extract(payload_json,'$.count') AS REAL)) AS steps
               FROM health_records WHERE type='StepsRecord' AND date(start_time) = ?""",
            (date,),
        ).fetchone()

        weight_row = conn.execute(
            """SELECT COUNT(*) AS c FROM health_records
               WHERE type='WeightRecord' AND date(time) <= ?""",
            (date,),
        ).fetchone()

        # 食事データ（nutrition_events）
        meal_row = conn.execute(
            "SELECT COUNT(*) AS c FROM nutrition_events WHERE local_date = ?",
            (date,),
        ).fetchone()

        # ── 根拠データの値取得
        steps_val = steps_row["steps"] if steps_row and steps_row["steps"] else None

        # 睡眠時間（最新セッション）
        sleep_session = conn.execute(
            """SELECT start_time, end_time FROM health_records
               WHERE type='SleepSessionRecord' AND date(start_time) = ?
               ORDER BY start_time DESC LIMIT 1""",
            (date,),
        ).fetchone()

        # 体重（最新値）
        weight_rec = conn.execute(
            """SELECT payload_json FROM health_records
               WHERE type='WeightRecord' AND date(time) <= ?
               ORDER BY time DESC LIMIT 1""",
            (date,),
        ).fetchone()

    # ── 充足フラグ
    sleep_ok = bool(sleep_row and sleep_row["c"] > 0)
    steps_ok = bool(steps_val and steps_val >= 1000)
    weight_ok = bool(weight_row and weight_row["c"] > 0)
    meal_ok = bool(meal_row and meal_row["c"] > 0)

    # ── 睡眠時間の整形
    sleep_label = None
    if sleep_session:
        try:
            from datetime import datetime as _datetime
            s = _datetime.fromisoformat(sleep_session["start_time"].replace("Z", "+00:00"))
            e = _datetime.fromisoformat(sleep_session["end_time"].replace("Z", "+00:00"))
            total_min = int((e - s).total_seconds() / 60)
            h, m = divmod(total_min, 60)
            sleep_label = f"{h}時間{m}分"
        except Exception:
            pass

    # ── 体重の整形
    weight_label = None
    if weight_rec:
        try:
            p = json.loads(weight_rec["payload_json"])
            for k in ("inKilograms", "kilograms", "kg"):
                if p.get(k) is not None:
                    weight_label = f"{float(p[k]):.1f}kg"
                    break
        except Exception:
            pass

    # ── 歩数の整形
    steps_label = f"{int(steps_val):,}歩" if steps_val else None

    # ── 根拠データリスト（データがあるものだけ）
    evidences = []
    if sleep_ok and sleep_label:
        evidences.append({
            "type": "sleep",
            "label": "睡眠",
            "value": sleep_label,
            "tab": "health",
            "innerTab": "sleep",
        })
    if steps_ok and steps_label:
        evidences.append({
            "type": "steps",
            "label": "歩数",
            "value": steps_label,
            "tab": "exercise",
        })
    if weight_ok and weight_label:
        evidences.append({
            "type": "weight",
            "label": "体重",
            "value": weight_label,
            "tab": "health",
            "innerTab": "composition",
        })
    if meal_ok:
        evidences.append({
            "type": "meal",
            "label": "食事",
            "value": f"{meal_row['c']}件",
            "tab": "meal",
        })

    return {
        "date": date,
        "report": (
            {"content": report_row["content"], "created_at": report_row["created_at"]}
            if report_row else None
        ),
        "sufficiency": {
            "sleep": sleep_ok,
            "steps": steps_ok,
            "weight": weight_ok,
            "meal": meal_ok,
        },
        "evidences": evidences,
    }
```

---

## 注意事項

- `json`, `Any`, `db`, `Depends`, `HTTPException`, `require_api_key` はすでに main.py の先頭で import 済みです
- `import datetime as _dt3` はすでに `_dt` と `_dt2` が使われているため `_dt3` を使います
- `from datetime import datetime as _datetime` は関数内で必要な箇所のみローカル import します
- 既存コードへの変更は一切不要です。末尾への追記のみで完結します
- 動作確認: `curl -H "X-Api-Key: <key>" "http://localhost:8765/api/home-summary?date=2026-02-25"`

---

## 実装後の追加対応（レビュー反映）

以下は実装レビューで見つかった懸念を解消するため、上記サンプル実装に対して追加で反映した変更点です。

1. 睡眠判定の基準日を `start_time` から「起床側（end_time優先）のローカル日付」に変更  
   - 前日就寝→当日起床の睡眠が当日分として評価されるよう修正

2. 日付判定を UTC の `date(...)` 依存からローカル日付判定へ補正  
   - `SleepSessionRecord` / `StepsRecord` / `WeightRecord` は前後1日分を取得して、Python側でローカル日付へ変換して判定

3. 体重 payload の抽出キーを拡張  
   - `inKilograms` / `kilograms` / `kg` に加えて、入れ子構造を含む数値探索を実施
   - g単位で入っている値に備えて `>500` は `kg` 換算を適用

4. 既存要件（レスポンススキーマ）は維持  
   - 返却キー構造 (`date`, `report`, `sufficiency`, `evidences`) は変更なし
