# Tech Debt Tracker

レビューで検出されたWARNING/SUGGESTION のうち、即時修正不要だがいずれ対応すべき項目。

---

## Active

（なし）

---

## Resolved

### TD-001: `as NutrientDetails` 型アサーション（food.ts）→ buildNutrients() ヘルパーに置換
### TD-002: multiplier計算のミューテーション（FoodConfirm.tsx）→ イミュータブル変換に修正
### TD-003: お気に入り検索エラー握りつぶし（FoodInput.tsx）→ 意図説明コメント追加
### TD-004: 編集モーダルのオーバーレイクリック閉じ未対応 → onClick追加
### TD-005: 編集フォームの入力バリデーション不足 → バリデーション+disabled制御追加
### TD-006: ExerciseScreen renderContent 290行 → 7コンポーネントに分割
### TD-007: HealthScreen / ExerciseScreen 間の7関数重複 → utils/chart.ts に抽出
### TD-008: report.ts 882行 → llm-providers.ts 分離で764行に削減

全8件: 2026-03-16 解消
