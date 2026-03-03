# Request: からだタブ改修 v2（I2v2）

- Date: 2026-03-03
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: I（タブ強化）
- Depends on: なし

## Background

からだタブ（HealthScreen）は初期実装のままで、以下の課題がある:
1. タブ名が「体組成」「バイタル」と専門的でわかりにくい（CEO指摘あり）
2. 睡眠APIが返している期間サマリーデータ（9フィールド）がフロントで未表示
3. 睡眠ステージの表示構成を整理する必要がある

## 変更内容

### 1. 内タブ名の変更

`web-app/src/screens/HealthScreen.tsx` の `InnerTabBar` を変更。

| Before | After |
|--------|-------|
| 体組成 | 体重 |
| バイタル | 血圧・心拍 |
| 睡眠 | 睡眠（変更なし） |

※ ボトムナビの「からだ」ラベルは変更しない。

### 2. 睡眠タブ: ステージ表示の再構成

**現状**: 上段の現在値カード内にステージ（深い/浅い/レム）が1行でまとめて表示されている。

**変更**:
- 上段カードからステージ行を**削除**
- 新しい「睡眠ステージ」カードを追加（チャートの下あたり）

#### 新「睡眠ステージ」カード

週表示時:
```
睡眠ステージ
深い睡眠    ○○分 (○○%)
浅い睡眠    ○○分 (○○%)
レム睡眠    ○○分 (○○%)
```
→ `stages.deep_min`, `stages.light_min`, `stages.rem_min` + 各比率を計算

月/年表示時:
```
平均睡眠ステージ
深い睡眠    ○○分 (○○%)
浅い睡眠    ○○分 (○○%)
レム睡眠    ○○分 (○○%)
```
→ `periodSummary.avg_deep_min`, `avg_light_min`, `avg_rem_min` + `deep_ratio`, `light_ratio`, `rem_ratio`

**データがない場合はカード自体を非表示にする。**

### 3. 睡眠タブ: 期間SpO2サマリーの追加

月/年表示時に、既存の「平均睡眠」「目標達成日」リストの下に追加:

```
平均血中酸素    ○○%
最低血中酸素    ○○%
```
→ `periodSummary.avg_spo2`, `periodSummary.min_spo2`

**データがない場合は行を非表示。**

### 4. 全タブ共通: データなし時の非表示ルール

**原則: データがあれば全て表示する。取れていない項目は非表示。**

各メトリック行で値が `null` の場合は行ごと非表示にする。
カード内の全行が非表示になった場合はカード自体を非表示にする。

これは体重タブ・血圧心拍タブにも適用する:
- 体重タブ: weight_kg, body_fat_pct, bmi, bmr_kcal, goalWeight 各行が null なら非表示
- 血圧心拍タブ: systolic/diastolic, resting_hr, heart_hr 各行が null なら非表示

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `web-app/src/screens/HealthScreen.tsx` | タブ名変更、睡眠ステージカード追加、SpO2サマリー追加、null非表示ロジック |
| `web-app/src/screens/HealthScreen.css` | 新カードのスタイル（既存の `health-current-card` と同等で可） |

※ バックエンド変更なし（APIは既に全データを返却済み）
※ `web-app/src/api/types.ts` 変更なし（型は既に定義済み）

## 制約

1. **ローカル確認フロー**: `wrangler dev` + `npm run dev` でローカル動作確認を行い、本番デプロイは別途指示を待つ
2. TypeScript ビルドが通ること
3. 既存のチャート表示は変更しない
4. `TabAiAdvice` コンポーネント（AIコメント欄）はそのまま維持

## Acceptance Criteria

1. 内タブ名が「体重 / 血圧・心拍 / 睡眠」に変更されている
2. 睡眠ステージが独立カードで表示される（週: 当日値、月年: 期間平均）
3. 月/年表示で期間SpO2サマリーが表示される
4. null値の項目が非表示になる（行レベル・カードレベル）
5. TypeScript ビルドが通る
6. 本番デプロイはしない（ローカル確認のみ）
