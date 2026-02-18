# Changelog (health-connect-sync)

## 2026-02-18
- ローカルPCサーバに「食事/サプリ」手入力ログ機能を追加
  - DB: `nutrition_events`
  - API:
    - `POST /api/nutrition/log`
    - `GET /api/nutrition/day?date=YYYY-MM-DD`
- 前日レポートAPIを追加
  - `GET /api/report/yesterday`
- 12:00 JST に Discord #体調管理 へ前日レポートを投稿するcronを追加
- エイリアス定義を追加（NUTRITION_RULES.md）
  - protein = ZAVAS MILK PROTEIN 脂肪0 キャラメル風味 200ml（107kcal / P20g / F0g / C6.8g）
  - vitamin_d（vitamin_d3_iu=2000 / vitamin_d3_mcg=50）
  - multivitamin（ビタミン12種+ミネラル7種をmicrosに登録）
  - fish_oil（epa_mg=190 / dha_mg=80 / omega3_mg=270）
- nutrition_events に PFC + micros_json を追加（サプリ項目の集計の土台）
- 栄養素をグラフ化しやすいよう、正規化テーブルを追加（dual-write）
  - nutrient_keys / nutrition_nutrients
  - 既存の micros_json は当面維持（安全）

NOTE:
- APIは `X-Api-Key` 必須（PC内の `.env` に保存）。チャットに貼る必要なし。
