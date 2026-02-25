# Iteration 5 — Codex 用指示書（/api/connection-status エンドポイント追加）

## 背景

Iteration 5 ではマイ画面の「Health Connect 連携状況」表示のための新エンドポイントを追加します。

## 対象ファイル

`pc-server/app/main.py` — 末尾に追記のみ

---

## 追加するエンドポイント

```
GET /api/connection-status
```

**用途:** Health Connect データの同期状況（最終同期日時、レコード総数、データ種別ごとの存在確認）を返す。

**レスポンス例:**
```json
{
  "last_sync_at": "2026-02-25T08:30:00+09:00",
  "total_records": 12450,
  "has_weight_data": true,
  "has_sleep_data": true,
  "has_activity_data": true,
  "has_vitals_data": false
}
```

---

## 実装コード

`main.py` の末尾に追加：

```python
@app.get("/api/connection-status")
def connection_status(_: None = Depends(require_api_key)) -> dict[str, Any]:
    """Health Connect 連携状況を返す。マイ画面用。"""
    with db() as conn:
        # 最終同期日時
        last_sync_row = conn.execute(
            "SELECT received_at FROM sync_runs ORDER BY received_at DESC LIMIT 1"
        ).fetchone()

        # 総レコード数
        total_row = conn.execute(
            "SELECT COUNT(*) AS c FROM health_records"
        ).fetchone()

        # データ種別ごとの存在確認
        weight_row = conn.execute(
            "SELECT COUNT(*) AS c FROM health_records WHERE type='WeightRecord' LIMIT 1"
        ).fetchone()

        sleep_row = conn.execute(
            "SELECT COUNT(*) AS c FROM health_records WHERE type='SleepSessionRecord' LIMIT 1"
        ).fetchone()

        activity_row = conn.execute(
            "SELECT COUNT(*) AS c FROM health_records WHERE type='StepsRecord' LIMIT 1"
        ).fetchone()

        vitals_row = conn.execute(
            """SELECT COUNT(*) AS c FROM health_records
               WHERE type IN ('BloodPressureRecord', 'RestingHeartRateRecord') LIMIT 1"""
        ).fetchone()

    return {
        "last_sync_at": last_sync_row["received_at"] if last_sync_row else None,
        "total_records": int(total_row["c"]) if total_row else 0,
        "has_weight_data": bool(weight_row and weight_row["c"] > 0),
        "has_sleep_data": bool(sleep_row and sleep_row["c"] > 0),
        "has_activity_data": bool(activity_row and activity_row["c"] > 0),
        "has_vitals_data": bool(vitals_row and vitals_row["c"] > 0),
    }
```

---

## 動作確認

```bash
curl -s -H "X-Api-Key: $KEY" \
  "http://localhost:8765/api/connection-status" \
  | python -m json.tool
```

確認ポイント：
- `last_sync_at` が同期済みの場合 null でない
- `total_records` が 0 より大きい
- 各 `has_*` フラグがデータに応じて true/false になっている

---

## 注意事項

- 末尾への追記のみ。既存コードは変更不要
- `db`, `Any`, `Depends`, `require_api_key` は import 済みなので追加不要
- 認証は `require_api_key` で保護すること（`_: None = Depends(require_api_key)`）

---

## 追加タスク: user_profile にゴール列追加

`/api/home-summary` の注目ポイント生成で `sleep_goal_minutes` と `steps_goal` を参照していますが、
列が存在しない場合はデフォルト値（7時間 / 8000歩）にフォールバックしている状態です。
ユーザーが自分の目標を設定できるよう、列を正式に追加してください。

### DB マイグレーション

`pc-server/app/db.py` の `init_db()` 内に以下を追加してください（`CREATE TABLE IF NOT EXISTS user_profile` の後）：

```python
# user_profile にゴール列を追加（既存 DB への後方互換マイグレーション）
for col, definition in [
    ("sleep_goal_minutes", "INTEGER DEFAULT 420"),
    ("steps_goal",         "INTEGER DEFAULT 8000"),
]:
    try:
        conn.execute(f"ALTER TABLE user_profile ADD COLUMN {col} {definition}")
    except Exception:
        pass  # 既に存在する場合は無視
```

### /api/profile GET の修正

`get_profile()` の返却値に2フィールドを追加：

```python
return {
    ...,                                          # 既存フィールドはそのまま
    "sleep_goal_minutes": row["sleep_goal_minutes"] if row else 420,
    "steps_goal":         row["steps_goal"]         if row else 8000,
}
```

### /api/profile PUT の修正

`upsert_profile()` が受け取る入力に2フィールドを追加：

```python
# 既存の upsert SQL の SET 句に追加
# sleep_goal_minutes = COALESCE(:sleep_goal_minutes, sleep_goal_minutes)
# steps_goal         = COALESCE(:steps_goal, steps_goal)
```

バインドパラメータに `sleep_goal_minutes` / `steps_goal` を追加し、`None` を渡した場合は既存値を保持する（COALESCE パターン）。

### 動作確認

```bash
# GET でデフォルト値が返ること
curl -s -H "X-Api-Key: $KEY" "http://localhost:8765/api/profile" | python -m json.tool

# PUT で更新できること
curl -s -X PUT -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"sleep_goal_minutes": 450, "steps_goal": 10000}' \
  "http://localhost:8765/api/profile" | python -m json.tool

# GET で更新値が反映されること
curl -s -H "X-Api-Key: $KEY" "http://localhost:8765/api/profile" | python -m json.tool
```

### 注意事項

- `init_db()` のマイグレーションは冪等（何度実行しても安全）にすること
- `profile.py` を修正する場合は `main.py` も合わせて確認すること
- 既存の `name`, `height_cm`, `goal_weight_kg` 等の動作を壊さないこと
