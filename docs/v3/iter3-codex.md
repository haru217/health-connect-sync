# Iteration 3 — Codex 用指示書（/api/activity-data 拡充）

## 背景

Iteration 0 で `/api/activity-data` を追加済みです。
Iteration 3 では **エクササイズタイプの日本語ラベル** と **距離・カロリーの精度改善** を行います。

## 対象ファイル

`pc-server/app/main.py` — `activity_data()` 関数の修正のみ

---

## タスク 1: distance_km の計算精度改善

現在の実装では DistanceRecord の `inMeters` フィールドを使っています。
一部のデバイスは `meters` フィールドを使うため、以下のようにフォールバックを追加してください。

`activity_data()` 関数内の今日の距離取得部分を修正：

```python
today_dist_row = conn.execute(
    """SELECT SUM(
         COALESCE(
           CAST(json_extract(payload_json,'$.inMeters') AS REAL),
           CAST(json_extract(payload_json,'$.meters') AS REAL),
           0
         )
       ) AS meters
       FROM health_records WHERE type='DistanceRecord' AND date(start_time) = ?""",
    (base_date,),
).fetchone()
```

---

## タスク 2: exercises のカロリー情報追加

現在の `exercise_rows` クエリにカロリー情報を追加してください：

```python
exercise_rows = conn.execute(
    """SELECT date(start_time) AS d, start_time, end_time,
              json_extract(payload_json,'$.exerciseType') AS etype,
              json_extract(payload_json,'$.title') AS title,
              json_extract(payload_json,'$.totalDistance.inMeters') AS dist_m,
              json_extract(payload_json,'$.energy.inKilocalories') AS kcal
       FROM health_records WHERE type='ExerciseSessionRecord'
       AND date(start_time) BETWEEN ? AND ?
       ORDER BY start_time DESC LIMIT 20""",
    (ex_start, base_date),
).fetchall()
```

そして exercises リストに `kcal` フィールドを追加：

```python
exercises.append({
    "date": r["d"],
    "type": etype,
    "title": r["title"] or label,
    "duration_min": _dur_min(r),
    "distance_km": dist_km,
    "kcal": round(float(r["kcal"])) if r["kcal"] else None,
})
```

---

## タスク 3: 期間サマリーの追加

`activity_data()` のレスポンスに `periodSummary` フィールドを追加してください。

`series` が取得された後、以下を計算して返すデータに追加：

```python
# 期間サマリー計算
valid_steps = [s["steps"] for s in series if s["steps"] is not None]
valid_kcal = [s["active_kcal"] for s in series if s["active_kcal"] is not None]

avg_steps = round(sum(valid_steps) / len(valid_steps)) if valid_steps else None
total_active_kcal = round(sum(valid_kcal)) if valid_kcal else None
```

レスポンスに追加：
```python
return {
    "baseDate": base_date,
    "period": period,
    "current": { ... },
    "series": series,
    "exercises": exercises,
    "periodSummary": {          # ← 追加
        "avg_steps": avg_steps,
        "total_active_kcal": total_active_kcal,
    },
}
```

---

## 動作確認

```bash
curl -s -H "X-Api-Key: $KEY" \
  "http://localhost:8765/api/activity-data?date=2026-02-25&period=week" \
  | python -m json.tool
```

確認ポイント：
- `exercises` に `kcal` フィールドがある
- `periodSummary` に `avg_steps` と `total_active_kcal` がある
- `current.distance_km` が null でない（DistanceRecord がある場合）

## 注意事項

- `activity_data()` 関数のみ修正。他の関数・エンドポイントは変更しない
- 既存の `EXERCISE_LABELS` 辞書は変更不要（既に日本語ラベルが入っている）
