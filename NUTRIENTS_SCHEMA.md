# Nutrients schema（キー命名）

方針：
- kcal/PFC は専用カラム（kcal, protein_g, fat_g, carbs_g）
- それ以外の栄養素は `micros_json` に `{key: value}` で格納
- **入力があるものだけ表示**（無いものは表示しない）

## キー命名規則
- `{nutrient}_{unit}`
- unitは基本このいずれか：`mg`, `mcg`, `g`, `iu`

例：
- `vitamin_d3_iu`
- `vitamin_d3_mcg`
- `vitamin_c_mg`
- `iron_mg`
- `folate_mcg`
- `sodium_mg`

## 今回使用しているキー（例）
- vitamin_d3_iu / vitamin_d3_mcg
- calcium_mg / magnesium_mg / zinc_mg / copper_mg / selenium_mcg / chromium_mcg
- vitamin_a_mcg / vitamin_b1_mg / vitamin_b2_mg / vitamin_b6_mg / vitamin_b12_mcg
- niacin_mg / pantothenic_acid_mg / biotin_mcg / folate_mcg
- vitamin_c_mg / vitamin_d_mcg / vitamin_e_mg
- epa_mg / dha_mg / omega3_mg
- salt_equivalent_g_max

※外食メニュー等で新しい栄養素が出てきたら、ここにキーを追記する（DB変更は不要）。
