# Request: sync後のdaily_metrics集計バグ修正（U5）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（バグ修正）
- Depends on: なし
- Priority: 最高

## 問題

ユーザーはHealth Connectからの同期を実行しているが、ホーム画面のレポート（ハルブリーフィング）が「データが2月25日を最後に9日間途絶えている」と報告する。

実際のAPIレスポンス（3/5時点）:
- sleep: null, steps: null（データなし扱い）
- weight, bp: データあり（`WHERE date <= ?` で直近値を取得）
- meal: 212kcal（食事記録あり）

## 原因の仮説

`sync.ts` で `rebuildAggregatesFromHealthRecords` をimportしているが、sync後に明示的に呼ばれていない可能性がある。

`ensureAggregatesUpToDate()` (`sync-aggregate.ts:325-349`) のタイムスタンプ比較ロジック:
```typescript
const latestIngestedAtMs = latestIngestedRow?.latestMs ?? 0
const lastAggregatedAtMs = lastAggregatedRow?.lastMs ?? 0
if (latestIngestedAtMs > lastAggregatedAtMs) {
  await rebuildAggregatesFromHealthRecords(db)
}
```

`latestIngestedAtMs` と `lastAggregatedAtMs` の比較が正しく動いていない可能性がある。

## 調査手順

1. `sync.ts` の `handleSync()` 関数で同期後に `rebuildAggregatesFromHealthRecords()` が確実に呼ばれるか確認
2. `ensureAggregatesUpToDate()` のタイムスタンプ取得SQLが正しいか確認
3. `health_records` テーブルに3月のデータが存在するか確認（`ingested_at` の値）
4. `record_type_counts` テーブルの `LAST_AGGREGATED_AT_MS` の値を確認
5. `daily_metrics` テーブルで3月のデータを確認

## 修正方針

- `handleSync()` 完了後に `await rebuildAggregatesFromHealthRecords(env.DB)` を明示的に呼ぶ
- または `ensureAggregatesUpToDate()` のタイムスタンプ比較を修正
- 修正後、同期を再実行してdaily_metricsが正しく更新されることを確認

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

修正後にデプロイ:
```bash
cd cloudflare-api && npx wrangler deploy
```

その後、curlでAPIをテスト:
```bash
curl -H "X-Api-Key: test12345" "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/home-summary?date=2026-03-05"
```

sleep, steps が null でなくなることを確認する。
