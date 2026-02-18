# Nutrition logging rules

このチャンネルでの表現を、ツール（pc-serverのSQLite）に入れる際のルール。

## エイリアス（覚える）
- 「プロテイン」= ZAVAS MILK PROTEIN 脂肪0 キャラメル風味 200ml（alias: `protein`）
  - 栄養（1本/200ml）：107kcal / P20.0g / F0g / C6.8g
  - Source: https://www.meiji.co.jp/products/sports/4902705095465.html
- 「ビタミンD」= Health Thru Nutrition Vitamin D3 2000IU softgel 1錠（alias: `vitamin_d`）
  - 項目: vitamin_d3_iu=2000 / vitamin_d3_mcg=50
  - Source: https://www.nhc.com/products/vitamin-d3-2000-iu-by-health-thru-nutrition
- 「マルチビタミン」= Nature Made Super Multi Vitamin & Mineral 1錠（alias: `multivitamin`）
  - 1粒当たり（抜粋ではなく“全部”登録済み）：
    - calcium_mg=200 / magnesium_mg=100 / zinc_mg=6 / copper_mg=0.6 / selenium_mcg=50 / chromium_mcg=20
    - vitamin_a_mcg=1200 / vitamin_b1_mg=1.5 / vitamin_b2_mg=1.7 / vitamin_b6_mg=2.0 / vitamin_b12_mcg=3
    - niacin_mg=15 / pantothenic_acid_mg=6 / biotin_mcg=50 / folate_mcg=240
    - vitamin_c_mg=125 / vitamin_d_mcg=10 / vitamin_e_mg=9
  - Source: https://www.otsuka-plus1.com/shop/g/g51371/
- 「フィッシュオイル」= ネイチャーメイド スーパーフィッシュオイル（alias: `fish_oil`）
  - 栄養成分 1粒(1.1g)：8.34kcal / P0.222g / F0.791g / C0〜0.1g / 食塩相当量0〜0.01g
  - 機能性関与成分：EPA190mg / DHA80mg（=omega3 270mg）
  - Source: https://www.otsuka.co.jp/nmd/product/item_315/

## 記録方針
- 記録は `POST /api/nutrition/log` に投入（手入力イベントとして保存）
- 栄養値（kcal/PFC/micros）は未登録でも記録できる（後で埋める）

## microsの命名規則
- `{nutrient}_{unit}` で保存（例：`vitamin_d3_iu`, `vitamin_c_mg`, `iron_mg`, `zinc_mg`, `folate_mcg`）
- DBにカラム追加は不要（`micros_json` で任意キーを保持）

## 追加したい情報（後で）
- ZAVASの栄養成分（kcal / protein / 1本の容量）
  -> ラベルを見て確定させると、日次合計が出せる
