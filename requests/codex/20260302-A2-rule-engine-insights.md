# Request: ルールエンジン — 気づき生成API

- Date: 2026-03-02
- Owner: Codex
- Status: `todo`
- Phase: A（基盤）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §6
- Depends on: A1（スコア算出）

## Background
スコア算出に続き、ルールエンジンで「気づき」（インサイト）を生成する。
閾値超え・トレンド・ベースライン逸脱・相関パターンを検知し、最大3-5個に絞って返す。

## Scope
- `cloudflare-api/src/` に気づき生成ロジックを追加
- スコアAPIと統合して `GET /api/scores?date=YYYY-MM-DD` のレスポンスにinsightsフィールドを追加

## ルールの種類

| 種別 | 例 | トリガー |
|------|-----|---------|
| 閾値超え | 血圧が135/85を超えた | 当日データ vs 医学ガイドライン |
| トレンド | 体重が7日連続増加 | 過去N日の方向性 |
| ベースライン逸脱 | HRVが個人平均から20%以上低下 | 当日 vs 過去14日平均 |
| 相関パターン | 睡眠スコア低い翌日は血圧が高い | 過去データのパターンマッチ |

## レスポンス形式（insightsフィールド追加）
```json
{
  "insights": [
    { "type": "positive", "domain": "activity", "text": "今週の歩数は先週より15%増えています" },
    { "type": "attention", "domain": "sleep", "text": "深い睡眠が3日連続で短めです" },
    { "type": "threshold", "domain": "bp", "text": "今朝の血圧は135/85付近でした" }
  ]
}
```

## 出力原則
- 「警告」ではなく「気づき」。事実を優しく伝える
- ポジティブな気づきも必ず混ぜる
- 最大5個に絞る（優先度でソート）
- この結果は後日LLMプロンプトの入力にも使う

## Acceptance Criteria
1. insights配列が最大5件返される
2. ポジティブな気づきが少なくとも1件含まれる（データがあれば）
3. 各insightにtype（positive/attention/threshold/trend）とdomainが付与される
4. テキストに技術用語を含めない（ユーザー向けの自然な日本語）
5. データが不足している場合はinsightsを空配列で返す
