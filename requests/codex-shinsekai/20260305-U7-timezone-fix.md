# Request: 歩数集計のタイムゾーンバグ修正（U7）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `done`
- Phase: U（バグ修正）
- Depends on: なし
- Priority: 最高

## 問題

`daily_metrics` の歩数がGoogle Fitの表示値と大きく乖離している。

| 日付 | Google Fit | daily_metrics | 差分 |
|------|-----------|---------------|------|
| 2/24 | 6,459 | 9,554 | +48% |
| 3/1 | 2,922 | 1,834 | -37% |
| 3/2 | 5,022 | 2,543 | -49% |
| 3/3 | 3,499 | 2,296 | -34% |
| 3/4 | 2,389 | 1,118 | -53% |

## 原因

`localDayFromIso()` がUTC日付をそのまま使用している。全タイムスタンプはUTC（`Z`サフィックス）で保存されているが、ユーザーはJST（+9h）。

**影響**: UTC 15:00〜23:59のレコード（= JST 00:00〜08:59）が**前日**に割り当てられる。毎日の午前中の歩数が前日にカウントされている。

実例:
- `2026-03-04T15:42:08Z`（= **3/5 00:42 JST**）→ 現在: 3/4に集計 ❌ → 正しくは: 3/5

## 修正内容

### 1. `cloudflare-api/src/constants.ts` に定数追加

```typescript
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000  // +9h in milliseconds
```

### 2. `cloudflare-api/src/handlers/sync-parsers.ts` の `localDayFromIso` 修正

```typescript
import { JST_OFFSET_MS } from '../constants'

export function localDayFromIso(value: string | null | undefined): string | null {
  const ms = parseIsoToMillis(value)
  if (ms == null) {
    return null
  }
  // UTCタイムスタンプにJSTオフセットを加算してから日付を抽出
  return isoDateFromMillis(ms + JST_OFFSET_MS)
}
```

**変更のポイント**:
- 既存の `parseIsoDatePart(value)` を使うパスを削除し、常にミリ秒変換 → JSTオフセット加算 → 日付抽出の流れにする
- `isoDateFromMillis` は `new Date(ms).toISOString().slice(0, 10)` なので、JSTオフセット加算後のUTC日付 = JST日付になる

### 3. 影響を受ける関数の確認

`localDayFromIso` は以下で使用されている（全て正しくJST日付になる）:
- `sync-aggregate.ts:103` — defaultDay算出
- `sync-aggregate.ts:108` — StepsRecord
- `sync-aggregate.ts:115` — DistanceRecord
- `sync-aggregate.ts:122` — ActiveCaloriesBurnedRecord
- `sync-aggregate.ts:129` — TotalCaloriesBurnedRecord
- `sync-parsers.ts:134` — sleepBucketDayのフォールバック（sleepは独自のoffset処理があるため影響小）

### 4. 変更しないもの

- `sleepBucketDay` — 既にpayload内の `startZoneOffset`/`endZoneOffset` でJSTオフセットを使用済み。フォールバック時に `localDayFromIso` を呼ぶが、修正で整合性が向上する。
- `dayInOffset` — 引数でオフセットを受け取る設計のため変更不要。

## デプロイ後の手順

1. デプロイ: `cd cloudflare-api && npx wrangler deploy`
2. 再集計をトリガー（`__meta__last_aggregated_at_ms` をリセット）:
```bash
cd cloudflare-api && npx wrangler d1 execute health_connect_sync --remote --command "UPDATE record_type_counts SET count = 0 WHERE record_type = '__meta__last_aggregated_at_ms'"
```
3. API呼び出しで再集計を実行:
```bash
curl -k -H "X-Api-Key: <KEY>" "https://health-connect-sync-api.kokomaru3-healthsync.workers.dev/api/home-summary?date=2026-03-05"
```

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

再集計後、daily_metricsの値を確認:
```sql
SELECT date, steps FROM daily_metrics WHERE date >= '2026-02-24' ORDER BY date
```

Google Fitの値に近づいていることを確認する（完全一致は期待しない。ソース間の重複除去は別課題U8として対応予定）。
