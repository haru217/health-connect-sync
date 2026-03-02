# Request: ルールエンジン — スコア算出API

- Date: 2026-03-02
- Owner: Codex-shinsekai
- Status: `done`
- Note: A1v2で再設計予定 → `requests/codex-shinsekai/20260303-A1v2-scoring-redesign.md`
- Phase: A（基盤）
- Design ref: `docs/plans/2026-03-02-health-os-design.md` §5

## Background
Health OS設計に基づき、4ドメイン（睡眠・身体・血圧・活動）のスコアを算出するルールエンジンをCloudflare Workers上に構築する。
LLMを使わずルールベースで動く基盤部分。

## Scope
- `cloudflare-api/src/` にスコア算出ロジックを追加
- 新エンドポイント: `GET /api/scores?date=YYYY-MM-DD`
- D1から当日 + 過去14日分のデータを取得してスコア計算

## スコア算出ロジック

| ドメイン | 入力データ | 評価基準 |
|---------|-----------|---------|
| 睡眠 | 睡眠時間・深い睡眠・HRV | 個人ベースライン（過去14日平均）比 + 絶対値 |
| 身体 | 体重・体脂肪率・筋肉量 | 目標との距離 + 週トレンド |
| 血圧 | 収縮期/拡張期 | 医学ガイドライン閾値 + 個人トレンド |
| 活動 | 歩数・運動時間・消費カロリー | 目標達成率 + 週平均比 |

## レスポンス形式
```json
{
  "date": "2026-03-02",
  "overall": { "score": 72, "color": "green" },
  "domains": {
    "sleep":    { "score": 65, "color": "yellow", "summary": "深い睡眠がやや短い" },
    "body":     { "score": 78, "color": "green",  "summary": "体重は安定" },
    "bp":       { "score": 70, "color": "green",  "summary": "正常範囲" },
    "activity": { "score": 55, "color": "yellow", "summary": "歩数が目標の60%" }
  },
  "baseline": { "sleep": 70, "body": 75, "bp": 72, "activity": 60 }
}
```

## 色の閾値
- 70以上: green（良好）
- 50-69: yellow（やや気になる）
- 50未満: red（確認した方がいい）

## Acceptance Criteria
1. `/api/scores` が4ドメインのスコア（0-100）と色を返す
2. 総合スコアは4ドメインの均等加重平均
3. ベースラインは過去14日の個人平均（データなしの場合はデフォルト値）
4. データが存在しないドメインはnull（非表示用）
5. 既存APIに影響なし
