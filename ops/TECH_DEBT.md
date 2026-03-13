# Tech Debt Tracker

レビューで検出されたWARNING/SUGGESTION のうち、即時修正不要だがいずれ対応すべき項目。

---

## Active

### TD-001: `as NutrientDetails` 型アサーション（food.ts）
- **File**: `web-app/src/api/food.ts` L143, L160
- **Source**: U3/U4 CTO レビュー (2026-03-05)
- **Issue**: `Object.fromEntries()` で型情報消失 → `as NutrientDetails` でキャスト。必須フィールド欠損で `undefined` になるリスク
- **Fix**: `mapApiItemToResult()` と同様に全フィールドを明示初期化するヘルパーに統一

### TD-002: multiplier計算のミューテーション（FoodConfirm.tsx）
- **File**: `web-app/src/components/FoodConfirm.tsx` L30-36
- **Source**: U3/U4 CTO レビュー (2026-03-05)
- **Issue**: シャローコピーに対するfor-inミューテーション。ルール「spread演算子で新規作成、直接変更禁止」に厳密違反
- **Fix**: `Object.fromEntries(Object.entries(...).map(...))` に変更

### TD-003: お気に入り検索エラー握りつぶし（FoodInput.tsx）
- **File**: `web-app/src/components/FoodInput.tsx` L24-26
- **Source**: U3/U4 CTO レビュー (2026-03-05)
- **Issue**: `catch { // ignore }` — ネットワーク障害時にフィードバックなし
- **Fix**: コメントに理由明記、またはインラインエラー表示追加

### TD-004: 編集モーダルのオーバーレイクリック閉じ未対応
- **File**: `web-app/src/components/FoodEditModal.tsx` L46
- **Source**: U3/U4 CTO レビュー (2026-03-05)
- **Issue**: 背景オーバーレイクリックでモーダルが閉じない
- **Fix**: オーバーレイ `onClick={onClose}` + 内側 `e.stopPropagation()`

### TD-005: 編集フォームの入力バリデーション不足
- **File**: `web-app/src/components/FoodEditModal.tsx` L33-42
- **Source**: U3/U4 CTO レビュー (2026-03-05)
- **Issue**: name/amount空文字、kcal等のNaN入力を許容
- **Fix**: 保存前に空文字チェック + Number変換後のisNaNチェック

### TD-006: ExerciseScreen renderContent 290行（50行ルール超過）
- **File**: `web-app/src/screens/ExerciseScreen.tsx`
- **Source**: I3 CTO レビュー (2026-03-04)
- **Issue**: `renderContent` が290行で50行ルール違反
- **Fix**: セクション別コンポーネントに分割

### TD-007: HealthScreen / ExerciseScreen 間の7関数重複
- **File**: `web-app/src/screens/ExerciseScreen.tsx`, `HealthScreen.tsx`
- **Source**: I3 CTO レビュー (2026-03-04)
- **Issue**: `formatXLabel`, `formatTooltipLabel`, `formatRounded` 等が両ファイルで重複
- **Fix**: 共通ユーティリティ `web-app/src/utils/chart.ts` に抽出

### TD-008: report.ts 882行（800行制限超過）
- **File**: `cloudflare-api/src/handlers/report.ts`
- **Source**: H4 CTO レビュー (2026-03-05)
- **Issue**: 800行制限を82行超過
- **Fix**: LLMプロバイダー別呼び出し関数を `llm-providers.ts` に分離

---

## Resolved

（なし）
