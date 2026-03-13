# Request: 食事Gemini解析API + 食品DB（H3）

- Date: 2026-03-04
- Owner: Codex-shinsekai
- Status: `done`
- Phase: H（ハルUX v2）
- Depends on: なし
- Priority: 高

## 概要

食事入力をGemini AIで解析し、全栄養素をJSON返却する機能。確認済みデータはローカルDBに蓄積し、次回以降はDB検索優先でAPI呼び出しを削減する。

参照: `ops/HARU_UX_VISION.md` §6

## DBマイグレーション

```sql
-- 食品マスター（Gemini解析結果の蓄積）
CREATE TABLE food_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  amount TEXT NOT NULL,
  kcal REAL,
  protein_g REAL,
  fat_g REAL,
  carbs_g REAL,
  micros_json TEXT,
  source TEXT NOT NULL DEFAULT 'gemini',  -- 'gemini' | 'manual' | 'official'
  verified INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- nutrition_eventsは既存テーブル。micros_jsonカラムが既にある。
```

### micros_json のスキーマ

MECE栄養素リスト（ops/HARU_UX_VISION.md参照）:

```json
{
  "saturated_fat_g": null,
  "omega3_mg": null,
  "omega6_mg": null,
  "trans_fat_g": null,
  "sugar_g": null,
  "fiber_g": null,
  "vitamin_a_ug": null,
  "vitamin_d_ug": null,
  "vitamin_e_mg": null,
  "vitamin_k_ug": null,
  "vitamin_b1_mg": null,
  "vitamin_b2_mg": null,
  "vitamin_b6_mg": null,
  "vitamin_b12_ug": null,
  "vitamin_c_mg": null,
  "niacin_mg": null,
  "folate_ug": null,
  "pantothenic_acid_mg": null,
  "biotin_ug": null,
  "sodium_mg": null,
  "potassium_mg": null,
  "calcium_mg": null,
  "magnesium_mg": null,
  "phosphorus_mg": null,
  "iron_mg": null,
  "zinc_mg": null,
  "copper_mg": null,
  "manganese_mg": null,
  "selenium_ug": null,
  "chromium_ug": null,
  "molybdenum_ug": null,
  "iodine_ug": null,
  "cholesterol_mg": null,
  "purine_mg": null,
  "caffeine_mg": null,
  "alcohol_g": null
}
```

## API エンドポイント

### POST /api/food/analyze

Gemini解析リクエスト:
```json
{
  "text": "すき家 牛丼並盛 + サラダセット"
}
```

写真の場合:
```json
{
  "image_base64": "...",
  "text": "昼食"
}
```

処理フロー:
1. テキスト入力 → まず `food_items` テーブルを検索（部分一致）
2. ヒットあり → DB結果を返却（`source: "db"`）
3. ヒットなし → Gemini API呼び出し → 結果返却（`source: "gemini"`）

レスポンス:
```json
{
  "source": "gemini",
  "items": [
    {
      "name": "牛丼並盛",
      "brand": "すき家",
      "amount": "1杯",
      "kcal": 733,
      "protein_g": 22.9,
      "fat_g": 25.0,
      "carbs_g": 104.1,
      "micros": { ... }
    },
    {
      "name": "サラダセット",
      "brand": "すき家",
      "amount": "1セット",
      "kcal": 85,
      "protein_g": 2.1,
      "fat_g": 5.2,
      "carbs_g": 7.8,
      "micros": { ... }
    }
  ]
}
```

### POST /api/food/confirm

ユーザー確認・保存:
```json
{
  "local_date": "2026-03-04",
  "consumed_at": "2026-03-04T12:30:00+09:00",
  "items": [
    {
      "name": "牛丼並盛",
      "brand": "すき家",
      "amount": "1杯",
      "kcal": 733,
      "protein_g": 22.9,
      "fat_g": 25.0,
      "carbs_g": 104.1,
      "micros": { ... },
      "save_to_favorites": true
    }
  ]
}
```

処理:
1. 各itemを `nutrition_events` に保存
2. `save_to_favorites: true` のitemは `food_items` に保存（verified=1）
3. 既存food_itemsにマッチする場合は `use_count++` + `last_used_at` 更新
4. `daily_metrics.intake_kcal` を再集計

### GET /api/food/search

食品DB検索:
```
GET /api/food/search?q=牛丼&limit=10
```

`food_items` テーブルをname/brand部分一致で検索、use_count降順。

### GET /api/food/history

食事履歴:
```
GET /api/food/history?date=2026-03-04
```

指定日の `nutrition_events` を返却。

## Geminiプロンプト

```
以下の食事内容から、全栄養素を推定してJSONで返してください。
外食チェーンの場合は公式栄養データに基づいてください。
一般的な食品は文科省食品成分表（八訂）の値を参考にしてください。

該当するものは全て返す、データがないものはnullとしてください。

入力: "${userInput}"

出力形式（厳密にこのJSON形式で返すこと）:
{
  "items": [
    {
      "name": "食品名",
      "brand": "ブランド名 or null",
      "amount": "量（1杯、200g等）",
      "kcal": number,
      "protein_g": number,
      "fat_g": number,
      "carbs_g": number,
      "micros": {
        "saturated_fat_g": number | null,
        "omega3_mg": number | null,
        ...全MECE栄養素リスト
      }
    }
  ]
}
```

## 環境変数

```
GEMINI_API_KEY=...  # Gemini API キー
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/migrations/XXXX_food_items.sql` | food_itemsテーブル作成 |
| `cloudflare-api/src/handlers/food.ts` | 新規: 食事関連ハンドラ（analyze/confirm/search/history） |
| `cloudflare-api/src/index.ts` | ルーティング追加 |
| `cloudflare-api/src/types.ts` | 型定義追加 |
| `cloudflare-api/wrangler.toml` | GEMINI_API_KEY バインディング追加（必要に応じて） |

## 制約

1. Gemini APIのレスポンスはJSONパースしてバリデーションする（不正なレスポンスはエラー返却）
2. food_items検索はGemini API呼び出し前に必ず実行（コスト削減）
3. micros_jsonのキー名は上記スキーマに従う（フロント側と合わせるため）
4. TypeScript ビルドが通ること

## Acceptance Criteria

1. POST /api/food/analyze でテキスト入力からGemini解析が実行される
2. food_itemsにヒットする場合はAPI呼び出しなしでDB結果が返る
3. POST /api/food/confirm で nutrition_events + food_items に保存される
4. GET /api/food/search でfood_items検索ができる
5. GET /api/food/history で日別の食事履歴が取得できる
6. micros_jsonに全MECE栄養素が含まれる（値はnull許容）
7. TypeScript ビルドが通る
