# Request: ホーム画面 — スコア表示UI（B1改訂版）

- Date: 2026-03-03
- Owner: Gemini
- Status: `todo`
- Phase: B（ホーム画面）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §5, §9, §10
- Depends on: A1v2（スコアリング再設計）
- CEO承認: 2026-03-03 UI方針・ドメイン構成についてCEO確認済み
- Supersedes: `requests/gemini/20260302-B1-home-screen-scores.md`

## Background
ホーム画面のメインビジュアルとしてスコアを表示する。
**重要: スコアは既存UIの「上に追加」するのではなく、既存のStatusBarを「置き換える」。**
スコアがこの画面で最も重要な情報であり、視覚的なヒーロー要素となる。

## CEO決定事項
- ドメイン名はアプリのボトムナビタブ名と連動させる
- スコアが画面の主役。既存のStatusBar（5項目のピル）は廃止しスコアカードで代替する
- 「既存のデザイン感を崩さず」= 全要素を残すことではなく、デザイントーンを維持すること

## 新ドメイン構成（4ドメイン）

| ドメインID | 表示名 | タップ遷移先 | 内容 |
|---|---|---|---|
| `sleep` | 睡眠 | コンディション → 睡眠サブタブ | 睡眠の質と量 |
| `activity` | アクティビティ | アクティビティタブ | 運動量・歩数 |
| `nutrition` | 食事 | 食事タブ | カロリーバランス |
| `condition` | コンディション | コンディションタブ | 血圧・心拍・体組成 |

## APIレスポンス形式

```json
{
  "date": "2026-03-03",
  "overall": { "score": 72, "color": "green" },
  "domains": {
    "sleep":     { "score": 65, "color": "yellow", "summary": "睡眠時間がやや短め" },
    "activity":  { "score": 55, "color": "yellow", "summary": "歩数が目標の60%" },
    "nutrition": { "score": 82, "color": "green",  "summary": "カロリーバランスは良好です" },
    "condition": { "score": 78, "color": "green",  "summary": "コンディションは良好です" }
  },
  "baseline": { "sleep": 70, "activity": 60, "nutrition": 75, "condition": 73 },
  "insights": [
    { "type": "attention", "domain": "sleep", "message": "...", "severity": "warning" },
    { "type": "positive", "domain": "nutrition", "message": "...", "severity": "positive" }
  ]
}
```
※ データがないドメインは `null`

## UI構成（上から順に）

### 1. DateNavBar（既存・変更なし）

### 2. 総合スコア（ヒーロー要素）
- **大きなドーナツ円** — 画面幅の40-50%程度のサイズ。画面の主役
- 円の中央にスコア数値（大きなフォント）
- 数値の下に1行テキスト（例: 「今日のコンディション」）
- 色は overall.color に対応（green/yellow/red）
- アニメーション: 0 → 実スコアまで滑らかに描画

### 3. ドメイン別スコアカード（StatusBarの代替）
- **横並び4カード**（2x2グリッドまたはスクロール）
- 各カードの構成:
  - 小ドーナツ円（36-40px程度）
  - ドメイン表示名（睡眠 / アクティビティ / 食事 / コンディション）
  - 実数値（例: 7.5h, 8,200歩, 1,850kcal, 120/80）
  - 色は各ドメインの color に対応
- **タップで対応タブに遷移**（既存の `onNavigate` を使用）
  - sleep → `{ tab: 'health', innerTab: 'sleep' }`
  - activity → `{ tab: 'exercise' }`
  - nutrition → `{ tab: 'meal' }`
  - condition → `{ tab: 'health' }`
- **データがないドメインはグレー表示**（非表示ではなく「--」で表示）
- 現行StatusBarのピル型UIは完全に削除する

### 4. 注目ポイント（既存AttentionSection・変更なし）
- insights APIの結果ではなく、既存の attentionPoints をそのまま表示
- 将来的に insights と統合予定だが、今回は既存のまま

### 5. 今日のまとめ / 専門家コメント（既存・変更なし）
- 既存の home-summary-card, ExpertSection はそのまま維持
- ExpertSection のアイコンをアバター画像に差し替える（B3完了済み）:
  - 医師（ユウ先生）: `/avatars/avatar-yu.png`
  - トレーナー（マイコーチ）: `/avatars/avatar-mai.png`
  - 管理栄養士（サキさん）: `/avatars/avatar-saki.png`
  - `.ai-icon-container` 内の SVG を `<img>` に置き換え、`border-radius: 50%` で丸くする

### 6. 空状態 / レポート未生成（既存・変更なし）

## 削除する既存要素
- `StatusBar` コンポーネント（ドメインスコアカードで代替）
- `STATUS_META` 定義（不要になる）
- `fallbackStatusItems()` 関数
- `HomeStatusItem` / `HomeStatusKey` 型（types.tsから）
- 関連CSS（`.home-status-section`, `.home-status-grid`, `.status-pill` 等）

## 追加する型定義（types.ts）

```typescript
export interface ScoreDomain {
  score: number
  color: 'green' | 'yellow' | 'red'
  summary: string
}

export interface ScoreData {
  date: string
  overall: { score: number; color: 'green' | 'yellow' | 'red' } | null
  domains: {
    sleep: ScoreDomain | null
    activity: ScoreDomain | null
    nutrition: ScoreDomain | null
    condition: ScoreDomain | null
  }
  baseline: {
    sleep: number
    activity: number
    nutrition: number
    condition: number
  }
  insights: Array<{
    type: string
    domain: string
    message: string
    severity: string
  }>
}
```

## 追加するAPI関数（healthApi.ts）

```typescript
export async function fetchScores(date: string): Promise<ScoreData> {
  const res = await fetch(`${API_BASE}/api/scores?date=${date}`)
  if (!res.ok) throw new Error('Failed to fetch scores')
  return res.json()
}
```

## デザイン要件
- 既存アプリのデザイントーンを維持（CSS変数: `--accent-color`, `--surface-color`, `--text-primary`等）
- 絵文字は使わない
- ネガティブワードは避け、色で状態を伝える
- ドーナツチャートはSVGで実装（外部ライブラリ不要）
- スマホファースト（max-width: 480px を基準）
- 色の値:
  - green: `--accent-color` 系（#4ba585 / #5ca67b）
  - yellow: `#f59e0b` / `#FFB74D` 系
  - red: `#ef4444` / `#EF5350` 系

## ドメインカードの実数値表示

各ドメインカードに表示する実数値は、scores APIのレスポンスには含まれない。
home-summary APIから取得する既存データを流用する:

| ドメイン | 表示する実数値 | データソース |
|---|---|---|
| 睡眠 | `7.5h` | home-summary の sufficiency / statusItems |
| アクティビティ | `8,200歩` | 同上 |
| 食事 | `1,850kcal` | 同上 |
| コンディション | `120/80` | 同上 |

実数値が取得できない場合は「--」を表示。

## Acceptance Criteria
1. 総合スコアが画面のヒーロー要素として大きく表示される
2. 4ドメイン（睡眠/アクティビティ/食事/コンディション）のスコアカードが表示される
3. 各ドメインカードのタップで対応するタブに遷移する
4. 旧StatusBar（5項目ピル）が完全に削除されている
5. ドーナツチャートに0→スコアのアニメーションがある
6. 色が3段階（緑70+/黄50-69/赤50未満）で正しく反映される
7. データなしドメインはグレー表示（「--」）
8. ExpertSectionのアイコンがアバター画像に差し替わっている
9. ローディング中はスケルトン表示
10. APIエラー時はフォールバック表示
11. 既存の注目ポイント・専門家コメント・レポートセクションが正常に表示される
