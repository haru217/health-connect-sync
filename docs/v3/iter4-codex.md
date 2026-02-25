# Iteration 4 — Codex 用指示書（/api/nutrition/day に AI コメント追加）

## 背景

Iteration 4 では `/api/nutrition/day` のレスポンスに AI コメントフィールドを追加します。

既存の `ai_reports` テーブルから当日の daily レポートを取得し、栄養士セクション（`<!--NUTRITIONIST-->` タグ）を抽出して返します。

## 対象ファイル

`pc-server/app/main.py` — `nutrition_day()` 関数の修正のみ

---

## 現行の nutrition_day エンドポイント

```python
@app.get("/api/nutrition/day")
def nutrition_day(date: str, _: None = Depends(require_api_key)) -> dict[str, Any]:
    from .nutrition import get_day_events, get_day_totals
    return {"date": date, "events": get_day_events(date), "totals": get_day_totals(date)}
```

---

## 修正後

```python
@app.get("/api/nutrition/day")
def nutrition_day(date: str, _: None = Depends(require_api_key)) -> dict[str, Any]:
    from .nutrition import get_day_events, get_day_totals
    import re as _re

    events = get_day_events(date)
    totals = get_day_totals(date)

    # ai_reports から当日の daily レポートを取得し、栄養士コメントを抽出
    ai_comment = None
    with db() as conn:
        report_row = conn.execute(
            """SELECT content FROM ai_reports
               WHERE report_date = ? AND report_type = 'daily'
               ORDER BY created_at DESC LIMIT 1""",
            (date,),
        ).fetchone()

    if report_row:
        content = report_row["content"]
        # <!--NUTRITIONIST-->...<!--/NUTRITIONIST--> を抽出
        m = _re.search(r'<!--NUTRITIONIST-->([\s\S]*?)<!--/NUTRITIONIST-->', content, _re.IGNORECASE)
        if m:
            ai_comment = m.group(1).strip()
        else:
            # タグが見つからない場合はレポート全体を使う（200文字に切り詰め）
            ai_comment = content.strip()[:200] if content.strip() else None

    return {
        "date": date,
        "events": events,
        "totals": totals,
        "ai_comment": ai_comment,
    }
```

---

## 動作確認

```bash
curl -s -H "X-Api-Key: $KEY" \
  "http://localhost:8765/api/nutrition/day?date=2026-02-25" \
  | python -m json.tool
```

確認ポイント：
- レスポンスに `ai_comment` フィールドがある
- `ai_reports` に当日のデータがある場合、`ai_comment` が null でない
- `ai_reports` にデータがない場合、`ai_comment` が null

---

## 注意事項

- `nutrition_day()` 関数のみ修正。他は変更不要
- `ai_comment` は栄養士コメントのみ（医師・トレーナーのコメントは含めない）
- `re` モジュールは関数内で `import re as _re` としてローカル import
- 既存の `events` / `totals` の構造は変更しない（後方互換性維持）
