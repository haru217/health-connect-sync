# Request: 各タブ画面にAIコメントを追加（D1）

- Date: 2026-03-03
- Owner: Codex（Codex-1 フロントエンド）
- Status: `todo`
- Phase: D（タブ強化）
- Depends on: C1（完了済み）

## Background
C1で実装した日次レポートAPI（`GET /api/report?date=YYYY-MM-DD`）は、タブ別のAIコメントを生成している:
- `tabs.condition` — ユウ先生（医師）のコメント
- `tabs.activity` — マイコーチ（トレーナー）のコメント
- `tabs.meal` — サキさん（管理栄養士）のコメント

現在これらは**どのタブ画面にも表示されていない**。各タブの末尾にExpertCardを追加する。

## 変更内容

### 1. ExpertCardコンポーネントを共通化
現在 `HomeScreen.tsx` にある `ExpertCard` コンポーネントを共有コンポーネントとして抽出する。

**移動先**: `web-app/src/components/ExpertCard.tsx`

ExpertCardは以下のpropsを受け取る（既存のまま）:
- `name`, `role`, `avatar`, `alt`, `borderColor`, `gradientFrom`, `gradientTo`, `content`, `hasDecoration`

`EXPERT_CONFIG` 定数も一緒に移動する（各画面で参照）。

HomeScreen.tsx からは import に変更する。

### 2. Report取得用hookを作成
**新規**: `web-app/src/hooks/useTabComment.ts`

```typescript
export function useTabComment(date: string, tabKey: 'condition' | 'activity' | 'meal'): {
  comment: string | null
  loading: boolean
}
```

- `GET /api/report?date={date}` を呼ぶ
- レスポンスの `tabs[tabKey]` を返す
- レポート未生成時（404）は `comment: null`
- エラー時も `comment: null`（静かに失敗）
- SWR/キャッシュは不要（単純なuseEffect + fetch）

### 3. 各タブ画面にExpertCard追加

#### HealthScreen.tsx
- コンテンツ末尾（`</div>` の直前）にExpertCard追加
- `useTabComment(activeDate, 'condition')` で取得
- ユウ先生の設定を使用（EXPERT_CONFIG[0]）
- `comment` が null の場合は非表示（セクション自体を出さない）

#### ExerciseScreen.tsx
- コンテンツ末尾にExpertCard追加
- `useTabComment(activeDate, 'activity')` で取得
- マイコーチの設定を使用（EXPERT_CONFIG[2]）

#### MealScreen.tsx
- コンテンツ末尾にExpertCard追加
- `useTabComment(activeDate, 'meal')` で取得
- サキさんの設定を使用（EXPERT_CONFIG[1]）

### 4. UIデザイン
- ExpertCardの見た目はHomeScreenと同じ（既存CSS流用）
- カードの上に区切り線（`border-top: 1px solid var(--border-color)`）
- セクションタイトル: 「AIアドバイス」
- ローディング中: 表示しない（静かに読み込み）
- コメントなし時: セクション非表示

## Report APIレスポンス形式（参考）
```json
{
  "date": "2026-03-02",
  "generated_at": "2026-03-02T16:00:20.724Z",
  "home": { "headline": "...", "yu": "...", "saki": "...", "mai": "..." },
  "tabs": {
    "condition": "血圧が高めの129/86となっています。...",
    "activity": "歩数が179歩と目標の8000歩から...",
    "meal": "摂取カロリーの詳細記録が限定的です。..."
  },
  "cached": true
}
```

## APIエンドポイント
- 既存: `GET /api/report?date=YYYY-MM-DD`（認証: X-Api-Key ヘッダー）
- healthApi.ts に `fetchReport(date: string)` を追加する
- 404時はnull返却（レポート未生成は正常ケース）

## Acceptance Criteria
1. HealthScreen末尾にユウ先生のAIコメントが表示される
2. ExerciseScreen末尾にマイコーチのAIコメントが表示される
3. MealScreen末尾にサキさんのAIコメントが表示される
4. ExpertCardがHomeScreenと同じデザインで表示される
5. レポート未生成時はAIコメントセクション自体が非表示
6. HomeScreenの既存ExpertSectionに影響しない
7. ExpertCardコンポーネントが共有化されている
