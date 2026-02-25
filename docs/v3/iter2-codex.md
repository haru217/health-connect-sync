# Iteration 2 — Codex 用指示書（バイタル系エンドポイント動作確認・修正）

## 背景

Iteration 0 で以下のエンドポイントを追加済みです：

- `GET /api/body-data?date=YYYY-MM-DD&period=week|month|year`
- `GET /api/sleep-data?date=YYYY-MM-DD&period=week|month|year`
- `GET /api/vitals-data?date=YYYY-MM-DD&period=week|month|year`

Iteration 2 では **既存エンドポイントの動作確認と修正** が主なタスクです。

## タスク一覧

### 1. /api/body-data の修正

現在の実装では BMI 計算のために2回目の `db()` を開いています。これを1回の接続にまとめてください。

`body_data()` 関数内の以下の部分を修正：

**修正前（2回 db() を開いている）:**
```python
    # BMI from weight + profile height
    bmi = None
    if cur_weight:
        try:
            with db() as conn2:
                p_row = conn2.execute("SELECT height_cm FROM user_profile LIMIT 1").fetchone()
            ...
```

**修正後（最初の with db() 内で一緒に取得）:**

`body_data()` 関数冒頭の `with db() as conn:` ブロック内に、BMI 用の profile 取得を追加：

```python
        # Profile（height, goal_weight）
        profile_row = conn.execute(
            "SELECT height_cm, goal_weight_kg FROM user_profile LIMIT 1"
        ).fetchone()
```

そして BMI 計算部分を修正：
```python
    bmi = None
    if cur_weight and profile_row and profile_row["height_cm"]:
        h_m = float(profile_row["height_cm"]) / 100.0
        bmi = round(cur_weight / (h_m * h_m), 1)
```

### 2. /api/sleep-data の stages データ充実

週セグメントでは積み上げバーグラフを使うため、各日の `deep_min` / `light_min` / `rem_min` が正確に返る必要があります。

現在の実装で `stages` がゼロになるケースがある場合（Health Connect のデータに stages がない場合）、セッション全体を `light_min` に割り当てるロジックが正しく動いているか確認してください。

`_parse_session` 関数内の以下のロジックを確認・修正：

```python
# セッション全体を light_min に割り当てるロジックが必ずあること
if deep_min + light_min + rem_min == 0:
    light_min = total_min
```

### 3. 動作確認

以下のコマンドで各エンドポイントの動作を確認してください：

```bash
# PC サーバーが起動している前提
BASE="http://localhost:8765"
KEY="<VITE_API_KEY の値>"

curl -s -H "X-Api-Key: $KEY" "$BASE/api/body-data?date=2026-02-25&period=week" | python -m json.tool
curl -s -H "X-Api-Key: $KEY" "$BASE/api/sleep-data?date=2026-02-25&period=week" | python -m json.tool
curl -s -H "X-Api-Key: $KEY" "$BASE/api/vitals-data?date=2026-02-25&period=week" | python -m json.tool
```

確認ポイント：
- `current` オブジェクトのフィールドが null でない（データが存在する場合）
- `series` が空配列でない（データが存在する場合）
- `period=year` でも正常にレスポンスが返ること

### 4. エラーハンドリング追加（任意）

各エンドポイントで `json_extract` が null を返したり型変換が失敗した場合に 500 エラーにならないよう、`try/except` を適切に追加してください。

特に `/api/sleep-data` の `_parse_session` 内の datetime パース部分は例外が出やすいため、フォールバックが確実に動いているか確認してください。

## 注意事項

- `main.py` のみ変更。他のファイルは変更不要
- DB は読み取り専用操作のみ（SELECT のみ）
- 本番 GCP VM での確認は Iteration 2 完了後に一括で行う
