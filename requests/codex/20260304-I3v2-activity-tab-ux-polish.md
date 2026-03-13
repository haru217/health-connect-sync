# I3v2: アクティビティタブ UXポリッシュ

## 概要

I3v1（アクティビティタブリフレッシュ）実装済みのExerciseScreenに対し、UXレビューに基づく6点の改善を行う。

**対象ファイル**:
- `web-app/src/screens/ExerciseScreen.tsx`
- `web-app/src/screens/ExerciseScreen.css`（必要に応じて）
- `web-app/src/screens/HealthScreen.tsx`（基礎代謝削除のみ）

---

## 変更点

### 1. 上部カードを関心事ごとに2枚に分割

現在1枚のカードに最大7項目が詰まっている。2枚に分割する。

**カード1（活動量）**:
- 歩数（+ 達成バッジ ※条件は変更2参照）
- 距離

**カード2（カロリー）**:
- 活動カロリー
- 総消費カロリー
- 摂取カロリー（データある場合のみ）
- 基礎代謝
- カロリー収支（摂取データある場合のみ）

2枚の `health-current-card` を間にマージン8pxで配置。

### 2. バッジをポジティブのみに変更

現在の不足/もう少し/達成の3段階 → **達成のみ表示**に変更。

```tsx
// 変更前
const showStepsBadge = data.stepsGoalIsCustom && displaySteps != null
let stepsStatus = '不足'
let stepsClass = 'danger'
if (stepsRatio >= 1.0) { stepsStatus = '達成'; stepsClass = 'good' }
else if (stepsRatio >= 0.7) { stepsStatus = 'もう少し'; stepsClass = 'warning' }

// 変更後
const showStepsBadge = data.stepsGoalIsCustom && displaySteps != null && stepsGoal > 0 && displaySteps >= stepsGoal
// showStepsBadge が true のときだけ <span className="status-badge good">達成</span> を表示
```

**理由**: 目標未達成時のネガティブ表示はモチベーションを下げる。データ可視化アプリとして、判断はユーザーに委ねる。

### 3. カロリーチャートをデータに応じて切り替え

現在は「消費 vs 摂取」のLineChartだが、摂取データがない場合は片方のラインしか表示されず違和感がある。

**摂取データが存在する場合** → カロリー収支バーチャート:
- `recharts` の `Cell` をインポート
- 各日の `balance = intake_kcal - total_kcal` を計算
- バーの色: balance >= 0 → `#81C784`（緑）、balance < 0 → `#E0E0E0`（グレー）
- タイトル: 「カロリー収支」
- `<ReferenceLine y={0} stroke="#999" />` でゼロラインを表示

```tsx
const hasIntakeData = series.some(d => d.intake_kcal != null && d.intake_kcal > 0)
const balanceData = hasIntakeData
  ? series.map(d => ({
      ...d,
      balance: d.intake_kcal != null && d.total_kcal != null
        ? Math.round(d.intake_kcal - d.total_kcal)
        : null,
    }))
  : []
```

**摂取データが存在しない場合** → 消費カロリーのBarChart:
- タイトル: 「消費カロリー」
- `total_kcal` をバーチャートで表示
- `fill="#F4A261"`

**注意**: 現在の `LineChart` + `Line` のインポートは不要になる場合は削除。

### 4. 目標達成日数を削除

期間サマリーから「目標達成日数」行を完全に削除。

```tsx
// 以下を削除
{hasSummaryGoalDays ? (
  <div className="health-list-item">
    <span className="health-list-item-label">目標達成日数</span>
    <span className="health-list-item-value">{periodSummary.goal_days} / {periodSummary.measured_days} 日</span>
  </div>
) : null}
```

関連する変数 `hasSummaryGoalDays` も削除。

### 5. アドバイスカードを自然な文章に変更

現在のアドバイスは「平均3,533歩/日（目標8,000歩）。平均活動カロリーは377kcal/日です。」とグラフのキャプションのような文体。自然な日本語に変更する。

**関数シグネチャ変更**:
```tsx
// stepsGoal と stepsGoalIsCustom を削除
function generateActivityAdvice(
  avgSteps: number | null,
  calorieBalance: number | null,
  avgActiveKcal: number | null,
  measuredDays: number,
  segment: Segment,
): string | null
```

**生成ロジック**:
```tsx
const period = segment === 'week' ? '今週' : segment === 'month' ? 'この1か月' : 'この1年'

// 歩数（ポジティブ解釈 or ニュートラル、ネガティブなし）
if (avgSteps != null && Number.isFinite(avgSteps)) {
  const rounded = Math.round(avgSteps)
  const stepsStr = rounded.toLocaleString()
  if (rounded >= 10000) {
    messages.push(`${period}は1日平均${stepsStr}歩と活発に動けています`)
  } else if (rounded >= 7000) {
    messages.push(`${period}は1日平均${stepsStr}歩でほどよく動けています`)
  } else {
    messages.push(`${period}は1日平均${stepsStr}歩でした`)
  }
}

// カロリー（観察的な解釈）
if (calorieBalance != null && Number.isFinite(calorieBalance)) {
  if (calorieBalance > 200) {
    messages.push('摂取カロリーが消費をやや上回っています')
  } else if (calorieBalance < -200) {
    messages.push('消費カロリーが摂取をやや上回っています')
  } else {
    messages.push('カロリーの摂取と消費はほぼ均衡しています')
  }
} else if (avgActiveKcal != null && Number.isFinite(avgActiveKcal)) {
  messages.push(`活動による消費は1日あたり約${Math.round(avgActiveKcal).toLocaleString()}kcalです`)
}
```

### 6. からだタブから基礎代謝を削除

**ファイル**: `web-app/src/screens/HealthScreen.tsx` の `CompositionTab`

基礎代謝はアクティビティタブのカロリーカードで表示するため、からだタブの体重セクションからは削除。

削除対象:
- `avgBmr` の計算（lines 262-267付近）
- `displayBmr` 変数
- `hasBmrMetric` 変数
- `hasCurrentCard` の条件から `hasBmrMetric` を除去
- BMR表示の `health-metric-row` ブロック（lines 280-285付近）

---

## 設計ポリシー

- **データ可視化アプリ**: 目標の達成/未達成を判定してユーザーにプレッシャーを与えない
- **ネガティブ表示なし**: バッジは達成時のみ、アドバイスは事実ベース+ポジティブ解釈のみ
- **自然な文章**: グラフキャプション風ではなく、人が話すような文体

---

## 検証

1. `npx tsc --noEmit` でビルドエラーなし
2. アクティビティタブ: 週/月/年で上部カードが2枚に分かれていること
3. アクティビティタブ: ネガティブバッジ（不足/もう少し）が表示されないこと
4. アクティビティタブ: カロリーチャートが摂取データ有無で切り替わること
5. アクティビティタブ: 目標達成日数が消えていること
6. アクティビティタブ: アドバイスが自然な文章であること
7. からだタブ > 体重: 基礎代謝行が消えていること
