# 仕様: Android 食事タブ + 食事登録API統合

**ステータス**: CEO承認待ち
**担当**: Codex（実装）/ Gemini（UIデザイン）
**関連ファイル**: `cloudflare-api/src/handlers/food.ts`, `cloudflare-api/src/handlers/nutrition-log.ts`

## 背景

食事APIは既にほぼ完成している（analyze/confirm/search/history/delete/update）。
現在CEOが手動でGemini Gem（チャット）を使って食事データを作成しているが、
v1.0ではアプリ内で完結する食事登録フローが必要。

## 既存API（変更不要）

| エンドポイント | 用途 |
|---|---|
| `POST /api/food/analyze` | テキスト or 画像 → Gemini解析 → 栄養データ返却 |
| `POST /api/food/confirm` | 解析結果を nutrition_events に保存 |
| `GET /api/food/search` | food_items DB検索（過去食品のキャッシュ） |
| `GET /api/food/history?date=YYYY-MM-DD` | 日別食事履歴取得 |
| `PUT /api/food/:id` | 食事データ編集 |
| `DELETE /api/food/:id` | 食事データ削除 |
| `POST /api/nutrition/log` | サプリ・簡易食品登録（alias or label） |

## Android食事タブ UXフロー

### メイン画面（食事タブ）

```
┌─────────────────────────────────┐
│ 3/17（月）          < >         │  ← 日付切替
├─────────────────────────────────┤
│ 🌅 朝食                         │
│   白米 1杯        235 kcal      │
│   味噌汁 1杯       45 kcal      │
├─────────────────────────────────┤
│ 🌞 昼食                         │
│   チキンカレー      650 kcal     │
├─────────────────────────────────┤
│ 🌙 夕食                         │
│   (未登録)                      │
├─────────────────────────────────┤
│ 💊 サプリ                        │
│   ビタミンD 1錠                  │
│   プロテイン 1杯   107 kcal     │
├─────────────────────────────────┤
│ 合計: 1,037 kcal / 目標 2,254   │
│ P: 65g  F: 28g  C: 142g        │
├─────────────────────────────────┤
│         [＋ 食事を追加]          │  ← FABまたはボタン
└─────────────────────────────────┘
```

**データ取得**: `GET /api/food/history?date=2026-03-17`
**meal_type でグループ**: breakfast / lunch / dinner / snack / supplement

### 食事追加フロー

```
[＋ 食事を追加] タップ
    ↓
┌─────────────────────────────────┐
│ 食事の種類を選択                 │
│                                 │
│  🌅 朝食   🌞 昼食   🌙 夕食    │
│  🍪 間食   💊 サプリ            │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ 食事を入力                      │
│                                 │
│ [📷 写真で入力]                  │ ← カメラ or ギャラリー
│                                 │
│ [🔍 テキストで検索]              │ ← food_items DB検索 → analyze
│                                 │
│ [✏️ 手入力]                     │ ← 直接入力フォーム
└─────────────────────────────────┘
```

### パターンA: 写真で入力

```
1. カメラ/ギャラリーから画像選択
2. オプション: テキスト補足入力（例: 「松屋の牛丼」）
3. POST /api/food/analyze { image_base64, text }
4. Gemini解析結果を表示（品目リスト + 栄養値）
5. ユーザーが確認・編集
6. POST /api/food/confirm { local_date, consumed_at, meal_type, items }
7. 食事タブに反映
```

### パターンB: テキスト検索

```
1. テキスト入力（例: 「白米」）
2. GET /api/food/search?q=白米
3. DB結果あり → 候補リスト表示 → 選択 → confirm
4. DB結果なし → POST /api/food/analyze { text: "白米" }
5. Gemini解析結果表示 → 確認 → confirm
```

### パターンC: サプリ登録

```
1. 「💊 サプリ」選択
2. 定義済みサプリリスト表示（SUPPLEMENT_CATALOG から）
3. 選択 + 個数入力
4. POST /api/nutrition/log { alias, count, local_date }
```

### パターンD: 手入力

```
1. フォーム表示: 品名・kcal・P・F・C
2. 入力 → POST /api/food/confirm で保存
```

## Gemプロンプトとの統合

### 現状の差分

CEOが使っているGemプロンプトは28栄養素CSVを出力する。
APIの `food/analyze` はJSON形式で37項目のmicrosを返す。

**フィールドマッピング**:

| Gem CSV列 | API micros key | 備考 |
|---|---|---|
| salt_g | sodium_mg | 変換必要: sodium_mg = salt_g × 393.7 |
| P_mg | phosphorus_mg | |
| Mg_mg | magnesium_mg | |
| K_mg | potassium_mg | |
| Ca_mg | calcium_mg | |
| Fe_mg | iron_mg | |
| Zn_mg | zinc_mg | |
| vA_μg | vitamin_a_ug | |
| vB1_mg | vitamin_b1_mg | |
| vB2_mg | vitamin_b2_mg | |
| vB6_mg | vitamin_b6_mg | |
| vB12_μg | vitamin_b12_ug | |
| vC_mg | vitamin_c_mg | |
| vD_μg | vitamin_d_ug | |
| vE_mg | vitamin_e_mg | |
| niacin_mg | niacin_mg | |
| folate_μg | folate_ug | |
| fiber_g | fiber_g | |
| alcohol_g | alcohol_g | |

→ Gemの出力はAPIでそのまま受け取れる（salt→sodium変換のみ注意）
→ APIのanalyzeプロンプトは既にGemより広い栄養素をカバーしている

### 変更不要な理由

`food/analyze` の `buildAnalyzePrompt()` は既に全37 MICRO_KEYS をスキーマとして
Gemini APIに送信しており、Gemのプロンプトを再利用する必要はない。
APIのプロンプトの方がカバー範囲が広い。

## API側の追加変更（任意）

### 1. nutrition/log に meal_type を追加（推奨）

現在 `POST /api/nutrition/log` は `meal_type` を保存しない。
サプリ登録時にも meal_type="supplement" を保存できると、食事タブでのグループ表示が綺麗になる。

```diff
  // nutrition-log.ts
  INSERT INTO nutrition_events(
-   consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note
- ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+   consumed_at, local_date, alias, label, count, unit, kcal, protein_g, fat_g, carbs_g, micros_json, note, meal_type
+ ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

### 2. 日別サマリーAPIの追加（推奨）

食事タブ上部に表示する1日合計値を返すエンドポイント。
`GET /api/nutrition/day` が既にあるが、マクロ目標値との比較を返すと便利。

## テスト

- 画像解析 → confirm → history に反映されることを確認
- テキスト検索 → DB hit → confirmの流れ
- サプリ登録 → meal_type="supplement" で保存
- 日付切替で正しい日の履歴が表示される
- 月額上限到達時の429エラーハンドリング
