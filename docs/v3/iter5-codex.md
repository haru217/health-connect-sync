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
