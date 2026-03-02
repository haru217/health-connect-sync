# Request: ルールエンジン — 気づき生成API

- Date: 2026-03-02
- Owner: Codex-shinsekai
- Status: `todo`
- Phase: A（基盤）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §6
- Depends on: A1（スコア算出）✅ 完了済み

## Background
スコア算出に続き、ルールエンジンで「気づき」（インサイト）を生成する。
閾値超え・ベースライン逸脱の2種で当日の注目ポイントを検知し、最大3-5個に絞って返す。

## Scope
- `cloudflare-api/src/` に気づき生成ロジックを追加
- スコアAPIと統合して `GET /api/scores?date=YYYY-MM-DD` のレスポンスにinsightsフィールドを追加
- 既存の `buildSummary()` 内の簡易インサイト（`{ level, message }` 形式）は残す。A2のinsightsは scores エンドポイント専用で `{ type, domain, text }` 形式

## ルールの種類

| 種別 | 例 | トリガー |
|------|-----|---------|
| 閾値超え | 血圧が135/85を超えた | 当日データ vs 医学ガイドライン |
| ベースライン逸脱 | HRVが個人平均から20%以上低下 | 当日 vs 過去14日平均 |

※ トレンド（N日連続変化）は体重・血圧など毎日記録されない指標が多く、データ疎の現状ではノイズになるため見送り。データ蓄積後に Phase C 以降で追加検討。
※ 相関パターン（ドメイン間のクロス分析）も Phase C 以降で追加検討。

## レスポンス形式（insightsフィールド追加）
```json
{
  "date": "2026-03-02",
  "overall": { "score": 72, "color": "green" },
  "domains": { ... },
  "baseline": { ... },
  "insights": [
    { "type": "positive", "domain": "activity", "text": "今日の歩数は目標の120%です" },
    { "type": "attention", "domain": "sleep", "text": "睡眠時間がいつもより短めでした" },
    { "type": "threshold", "domain": "bp", "text": "今朝の血圧は135/85付近でした" }
  ]
}
```

## typeの定義
- `positive` — 良い傾向・目標達成
- `attention` — ベースラインからの逸脱（20%以上）
- `threshold` — 医学的閾値超え（血圧135/85など）

## 出力原則
- 「警告」ではなく「気づき」。事実を優しく伝える
- ポジティブな気づきも必ず混ぜる
- 最大5個に絞る（優先度でソート）
- この結果は後日LLMプロンプトの入力にも使う

## Acceptance Criteria
1. insights配列が最大5件返される
2. ポジティブな気づきが少なくとも1件含まれる（データがあれば）
3. 各insightにtype（positive/attention/threshold）とdomainが付与される
4. テキストに技術用語を含めない（ユーザー向けの自然な日本語）
5. データが不足している場合はinsightsを空配列で返す
6. 既存の scores レスポンス（overall/domains/baseline）は変更しない
