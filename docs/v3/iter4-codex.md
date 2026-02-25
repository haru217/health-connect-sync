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

---

## 追加タスク: /api/home-summary の基本テスト追加

`pc-server/test_api.py` にテストケースを追加してください。
既存のファイルがあればそこに追記、なければ新規作成してください。

### テストの前提

```python
# pc-server/test_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
API_KEY = "test-key"  # テスト用。実際の環境変数から取るよう調整可

def auth():
    return {"X-Api-Key": API_KEY}
```

### 追加するテストケース

```python
class TestHomeSummary:
    def test_returns_required_fields(self):
        """必須フィールドが全て返ること"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "date" in body
        assert "report" in body
        assert "sufficiency" in body
        assert "statusItems" in body
        assert "attentionPoints" in body
        assert isinstance(body["statusItems"], list)
        assert isinstance(body["attentionPoints"], list)

    def test_status_items_structure(self):
        """statusItems の各要素が必要なキーを持つこと"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        items = res.json()["statusItems"]
        for item in items:
            assert "key" in item
            assert "label" in item
            assert "ok" in item
            assert "tab" in item
            assert isinstance(item["ok"], bool)

    def test_attention_points_structure(self):
        """attentionPoints の各要素が必要なキーを持つこと"""
        res = client.get("/api/home-summary?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        points = res.json()["attentionPoints"]
        for pt in points:
            assert "id" in pt
            assert "icon" in pt
            assert "message" in pt
            assert "severity" in pt
            assert pt["severity"] in ("critical", "warning", "info", "positive")
            assert len(pt["message"]) <= 60

    def test_invalid_date_returns_400(self):
        """不正な日付で 400 を返すこと"""
        res = client.get("/api/home-summary?date=not-a-date", headers=auth())
        assert res.status_code == 400

    def test_no_auth_returns_401(self):
        """API キーなしで 401 を返すこと"""
        res = client.get("/api/home-summary?date=2026-02-25")
        assert res.status_code in (401, 403)

    def test_future_date_returns_empty(self):
        """未来の日付でもエラーにならず空データを返すこと"""
        res = client.get("/api/home-summary?date=2099-01-01", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert body["report"] is None


class TestNutritionDay:
    def test_has_ai_comment_field(self):
        """ai_comment フィールドが存在すること（null でも可）"""
        res = client.get("/api/nutrition/day?date=2026-02-25", headers=auth())
        assert res.status_code == 200
        body = res.json()
        assert "ai_comment" in body
        # null か文字列のどちらか
        assert body["ai_comment"] is None or isinstance(body["ai_comment"], str)
```

### 実行方法

```bash
cd pc-server
python -m pytest test_api.py -v
```

### 注意事項

- テストは実際の DB に対して実行される（モックなし）
- `API_KEY` は `os.getenv("VITE_API_KEY", "test")` から取得する形に調整すること
- テストが DB 依存のため、データがない日付でもエラーにならないことを確認する
