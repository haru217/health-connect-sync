# Request: スコアリング再設計（A1v2）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `done`
- Phase: A（基盤）
- Depends on: A1（完了済み）、R1（完了済み）
- CEO承認: 2026-03-03 ドメイン構成についてCEO確認済み

## Background
A1で実装した4ドメイン（sleep/body/bp/activity）を再設計する。
CEO議論の結果、以下の問題を解決する:
1. **食事（nutrition）がスコアに反映されていない** — intake_kcal, bmr_kcalは収集済みなのにスコア未使用
2. **body と bp が別ドメインである必要がない** — どちらも結果指標。1つの「コンディション」に統合
3. **resting_bpm, heart_bpm がスコア未使用** — 健康上重要なデータが無視されている
4. **ドメイン名がアプリのタブ名と不一致** — ボトムナビは「コンディション/アクティビティ/食事」

## ドメイン構成（変更後）

| ドメインID | 表示名 | 対応タブ | 入力データ |
|---|---|---|---|
| `sleep` | 睡眠 | コンディション→睡眠 | sleep_hours + spo2_pct |
| `activity` | アクティビティ | アクティビティ | steps + active_kcal + distance_km |
| `nutrition` | 食事 | 食事 | intake_kcal vs bmr_kcal |
| `condition` | コンディション | コンディション | BP + resting_bpm + weight_kg + body_fat_pct |

**変更前との対応:**
- `sleep` → そのまま（ロジック変更なし）
- `activity` → 旧 `activity` + distance_km追加
- `nutrition` → **新規追加**
- `condition` → 旧 `body` + 旧 `bp` + resting_bpm を統合

## スコアリングロジック

### sleep（変更なし）
現行の `sleepAbsoluteScore` をそのまま使用。

### activity（微修正）
現行の `activityAbsoluteScore` に `distance_km` を追加:
```
scores = []
if steps != null: scores.push(min(100, steps / stepsGoal * 100))
if active_kcal != null: scores.push(min(100, active_kcal / 300 * 100))
if distance_km != null: scores.push(min(100, distance_km / 5.0 * 100))  // 5km = 100点
return average(scores)
```

### nutrition（新規）
```
if intake_kcal == null: return null
if bmr_kcal == null or bmr_kcal <= 0: bmr_kcal = 1500 (デフォルト)

ratio = intake_kcal / bmr_kcal

// 適正範囲: BMRの0.9〜1.4倍（活動量により消費が増えるため上限は余裕を持つ）
if 0.9 <= ratio <= 1.4: score = 90 + (1.0 - abs(ratio - 1.15)) * 40  // 1.15中心で最高点
elif 0.7 <= ratio < 0.9: score = 70 - (0.9 - ratio) * 100  // 摂取不足
elif 1.4 < ratio <= 1.8: score = 70 - (ratio - 1.4) * 75   // 摂取過多
else: score = max(20, 50 - abs(ratio - 1.15) * 30)          // 大幅な逸脱

return clampScore(score)
```

**summary生成:**
- ratio < 0.8: 「摂取カロリーがやや少なめです」
- 0.8 <= ratio <= 1.5: 「カロリーバランスは良好です」
- ratio > 1.5: 「摂取カロリーがやや多めです」

### condition（統合）
旧body + 旧bp + resting_bpmの加重平均:
```
scores = []
weights = []

// BP（最重要 — 健康リスクに直結）
bpScore = bpAbsoluteScore(row)  // 現行ロジックそのまま
if bpScore != null:
  scores.push(bpScore)
  weights.push(3)

// 安静時心拍数（新規）
if resting_bpm != null:
  if resting_bpm < 60: hrScore = 95       // 良好（アスリート水準）
  elif resting_bpm < 70: hrScore = 85     // 正常
  elif resting_bpm < 80: hrScore = 70     // やや高め
  elif resting_bpm < 90: hrScore = 55     // 高め
  else: hrScore = 40                       // 要確認
  scores.push(hrScore)
  weights.push(2)

// 体組成（現行bodyAbsoluteScoreロジック）
bodyScore = bodyAbsoluteScore(row, profile)
if bodyScore != null:
  scores.push(bodyScore)
  weights.push(2)

return weightedAverage(scores, weights)  // 重み付き平均
```

**summary生成:**
- BPが主要因の場合: 旧bpSummaryをベースに
- 体重が主要因の場合: 旧bodySummaryをベースに
- 全体良好: 「コンディションは良好です」

## APIレスポンス形式（変更後）

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
  "baseline": {
    "sleep": 70,
    "activity": 60,
    "nutrition": 75,
    "condition": 73
  },
  "insights": [ ... ]
}
```

**breaking change:**
- `domains.body` → 削除（`condition` に統合）
- `domains.bp` → 削除（`condition` に統合）
- `domains.nutrition` → 新規追加
- `baseline` のキーも同様に変更

## 実装手順

1. `nutritionAbsoluteScore()` 関数を新規作成
2. `conditionAbsoluteScore()` 関数を新規作成（bp + resting_bpm + body の加重平均）
3. `nutritionSummary()`, `conditionSummary()` を新規作成
4. `getScores()` 内のドメイン構成を変更（sleep/activity/nutrition/condition）
5. `baseline` オブジェクトのキーを更新
6. `generateInsights()` のドメイン参照を更新
7. `/api/home-summary` の `statusItems` 生成ロジックも新ドメインに合わせて更新

## 色の閾値（変更なし）
- 70以上: `green`
- 50-69: `yellow`
- 50未満: `red`

## Acceptance Criteria
1. `/api/scores` が4ドメイン（sleep/activity/nutrition/condition）を返す
2. nutrition ドメインが intake_kcal / bmr_kcal ベースでスコア算出される
3. condition ドメインが BP + resting_bpm + body の加重平均で算出される
4. 旧ドメイン（body, bp）はレスポンスに含まれない
5. データがないドメインは null
6. overall は4ドメインの均等加重平均
7. baseline も新4ドメインに対応
8. 既存の insights 生成が壊れない
9. `/api/home-summary` の statusItems が新ドメインと整合する
