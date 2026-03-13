# Request: 食事タブUI（H5）

- Date: 2026-03-04
- Owner: Gemini
- Status: `todo`
- Phase: H（ハルUX v2）
- Depends on: H3（食事Gemini解析API）
- Priority: 高

## 概要

食事タブのUI実装。Gemini AI解析による食事入力 + 栄養素表示 + お気に入り + 履歴。

参照: `ops/HARU_UX_VISION.md` §6

## 画面構成

### 食事タブ トップ画面

1. **今日の食事サマリー**
   - 合計: kcal / P / F / C
   - 食事リスト（朝食・昼食・夕食・間食）

2. **食事入力ボタン**（常時表示、目立つ配置）
   - 「+ 食事を記録」

3. **過去の食事履歴**
   - 日付ナビゲーション
   - GET /api/food/history?date=YYYY-MM-DD

### 食事入力フロー

**Step 1: 入力**
- テキスト入力フィールド（「すき家 牛丼並盛 + サラダ」等）
- 写真撮影ボタン（将来対応。MVPではテキストのみでもOK）
- お気に入りからの選択（food_items検索）
- 「解析」ボタン → POST /api/food/analyze

**Step 2: 確認・修正**
- Gemini解析結果を一覧表示
- 各item:
  - 食品名、ブランド、量
  - マクロ: kcal / P / F / C
  - 微量栄養素: 展開可能なアコーディオン
- 各値は編集可能（タップで数値変更）
- 「お気に入りに追加」チェックボックス
- 「記録する」ボタン → POST /api/food/confirm

**Step 3: 完了**
- 「記録しました」トースト
- トップ画面に戻り、サマリー更新

### 栄養素詳細表示

日別の栄養素サマリー（全MECE栄養素）:

**マクロ:** kcal / たんぱく質 / 脂質（飽和・不飽和・トランス） / 炭水化物（糖質・食物繊維）

**ビタミン:** A, D, E, K, B1, B2, B6, B12, C, ナイアシン, 葉酸, パントテン酸, ビオチン

**ミネラル:** Na, K, Ca, Mg, P, Fe, Zn, Cu, Mn, Se, Cr, Mo, I

**その他:** コレステロール, プリン体, カフェイン, アルコール

カテゴリごとにグループ表示。nullの項目は「-」表示。

## API依存

| エンドポイント | 用途 |
|-------------|------|
| POST /api/food/analyze | Gemini解析 |
| POST /api/food/confirm | 確認・保存 |
| GET /api/food/search | お気に入り検索 |
| GET /api/food/history | 日別履歴 |

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/screens/FoodScreen.tsx` | 新規: 食事タブ画面 |
| `web-app/src/components/FoodInput.tsx` | 新規: 食事入力コンポーネント |
| `web-app/src/components/FoodConfirm.tsx` | 新規: 確認・修正画面 |
| `web-app/src/components/NutrientTable.tsx` | 新規: 栄養素テーブル表示 |
| `web-app/src/api/types.ts` | 食事関連の型定義追加 |
| `web-app/src/api/food.ts` | 新規: 食事APIクライアント |

## 制約

1. MVPでは写真入力は後回しでもOK（テキスト入力が動けば十分）
2. 見た目の完成度は後回し。情報の配置と操作フローが正しければOK
3. UIの最終デザインはCEO承認が必要
4. TypeScript ビルドが通ること

## Acceptance Criteria

1. テキスト入力 → Gemini解析 → 結果表示ができる
2. 解析結果の各値を修正できる
3. 「記録する」で nutrition_events に保存される
4. お気に入り登録・検索ができる
5. 日別の食事履歴が表示される
6. 全MECE栄養素がカテゴリ別に表示される
7. 今日の食事サマリー（kcal/PFC合計）が表示される
8. TypeScript ビルドが通る
