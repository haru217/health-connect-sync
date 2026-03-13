# Request: 歩数の区間マージによる重複除去（U8）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（データ精度改善）
- Depends on: U7（タイムゾーン修正）完了済み
- Priority: 高

## 問題

タイムゾーン修正（U7）後もGoogle Fitの歩数と `daily_metrics` に大きな乖離がある。

| 日付 | Google Fit | daily_metrics | 差分 |
|------|-----------|---------------|------|
| 2/24 | 6,459 | 9,112 | +41%（過大） |
| 3/1 | 2,922 | 2,123 | -27%（過小） |
| 3/2 | 5,022 | 2,287 | -54%（過小） |
| 3/3 | 3,499 | 2,657 | -24%（過小） |
| 3/4 | 2,389 | 1,431 | -40%（過小） |

## 原因

### 原因1: ソース内の重複セグメント（過大カウント）

`com.google.android.apps.fitness` ソースが時間的に重複するセグメントを出力する。現在は単純SUMなので二重カウントされる。

```
例: 2/24の google.fitness — 300レコード、SUM=9,554 → Google Fit表示は6,459
```

### 原因2: collapseDaySourceMaxが異なるデバイスの歩数を捨てる（過小カウント）

`collapseDaySourceMax` は全ソースのMAXを取る。しかし `android`/`google.fitness`（スマホ）と `ringconn`（リング）は **異なるデバイス** で、スマホを持っていない時間帯のリング歩数が消える。

```
例: 3/4
  android:        1,118歩（スマホ）
  google.fitness: 1,118歩（スマホ — 同じデータ）
  ringconn:       1,055歩（リング — 別デバイス）

  現在: MAX(1118, 1118, 1055) = 1,118 ← リング歩数が消失
  Google Fit: 2,389（スマホ+リングの重複除去後の合算）
```

## 修正方針: 区間マージ（睡眠と同じアプローチ）

Google Fitが内部で行っているのと同じ処理を実装する:

1. 全ソースのStepsRecordを `(start_ms, end_ms, count)` タプルとして収集（ソースを区別しない）
2. 時間区間が重なるセグメントは、重複部分で歩数が多い方を採用
3. 重ならない区間はそのまま合算

### 実装

#### `sync-aggregate.ts` の StepsRecord 処理を変更

**Before（現状）:**
```typescript
} else if (row.type === 'StepsRecord') {
  const day = localDayFromIso(row.start_time) ?? defaultDay
  const count = findNumber(payload, new Set(['count']))
  if (day && count != null) {
    addBySource(stepsByDaySource, day, source, count)
  }
  recordDay = day
}
```

**After:**
```typescript
} else if (row.type === 'StepsRecord') {
  const day = localDayFromIso(row.start_time) ?? defaultDay
  const count = findNumber(payload, new Set(['count']))
  const startMs = parseIsoToMillis(row.start_time)
  const endMs = parseIsoToMillis(row.end_time)
  if (day && count != null && startMs != null && endMs != null && endMs > startMs) {
    const intervals = stepIntervalsByDay.get(day) ?? []
    intervals.push([startMs, endMs, count])
    stepIntervalsByDay.set(day, intervals)
  }
  recordDay = day
}
```

#### 新しい `mergedIntervalSteps` 関数を `sync-parsers.ts` に追加

```typescript
/**
 * 重複する歩数区間をマージし、合計歩数を返す。
 *
 * アルゴリズム:
 * 1. 区間を開始時刻でソート
 * 2. 重なる区間は「歩数/秒」レートが高い方を採用
 * 3. 重ならない区間はそのまま加算
 */
export function mergedIntervalSteps(intervals: Array<[number, number, number]>): number {
  if (intervals.length === 0) return 0

  // 開始時刻でソート
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])

  // 重複除去: 各ミリ秒の歩数レートが最も高いセグメントを採用
  // 簡易アプローチ: 重なりがある場合、長い区間より短い区間（より正確）を優先
  const merged: Array<[number, number, number]> = []
  let [curStart, curEnd, curSteps] = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const [nextStart, nextEnd, nextSteps] = sorted[i]

    if (nextStart >= curEnd) {
      // 重ならない → 現在の区間を確定
      merged.push([curStart, curEnd, curSteps])
      curStart = nextStart
      curEnd = nextEnd
      curSteps = nextSteps
    } else {
      // 重なる → 歩数/秒レートで比較、高い方の区間を採用
      const curRate = curSteps / (curEnd - curStart)
      const nextRate = nextSteps / (nextEnd - nextStart)

      if (nextEnd <= curEnd) {
        // nextが完全にcurの中に含まれる
        // 高レートな方を選択（ただし両方の非重複部分は保持）
        if (nextRate > curRate) {
          // next区間の方が精度が高い → nextを採用し、curの前後の非重複部分を保持
          const beforeMs = nextStart - curStart
          const afterMs = curEnd - nextEnd
          if (beforeMs > 0) {
            merged.push([curStart, nextStart, Math.round(curRate * beforeMs)])
          }
          merged.push([nextStart, nextEnd, nextSteps])
          if (afterMs > 0) {
            curStart = nextEnd
            curSteps = Math.round(curRate * afterMs)
            // curEndはそのまま
          } else {
            // curの残りなし → 次のイテレーションへ
            if (i + 1 < sorted.length) {
              [curStart, curEnd, curSteps] = sorted[i + 1]
              i++
            } else {
              curStart = 0; curEnd = 0; curSteps = 0
            }
          }
        }
        // else: curの方がレートが高い → nextを無視（curをそのまま継続）
      } else {
        // 部分的に重なる
        // 重なり部分は高レートな方、非重複部分はそれぞれ
        const overlapStart = nextStart
        const overlapEnd = curEnd

        if (curRate >= nextRate) {
          // cur側を優先 → curをそのまま延長せず確定、nextの非重複部分を新curに
          merged.push([curStart, curEnd, curSteps])
          const remainMs = nextEnd - curEnd
          const remainSteps = Math.round(nextRate * remainMs)
          curStart = curEnd
          curEnd = nextEnd
          curSteps = remainSteps
        } else {
          // next側を優先 → curの非重複部分を確定、next全体を新curに
          const beforeMs = nextStart - curStart
          const beforeSteps = Math.round(curRate * beforeMs)
          if (beforeMs > 0) {
            merged.push([curStart, nextStart, beforeSteps])
          }
          curStart = nextStart
          curEnd = nextEnd
          curSteps = nextSteps
        }
      }
    }
  }

  if (curEnd > curStart && curSteps > 0) {
    merged.push([curStart, curEnd, curSteps])
  }

  return merged.reduce((sum, [, , steps]) => sum + steps, 0)
}
```

**注意**: 上記は参考実装。アルゴリズムが複雑すぎる場合は、以下の簡易版でも十分な精度が出る可能性がある:

```typescript
// 簡易版: 同じ時間帯の重複をステップレートで除去
export function mergedIntervalSteps(intervals: Array<[number, number, number]>): number {
  if (intervals.length === 0) return 0

  // 1分単位のバケットに分割し、各バケットで最大レートのセグメントを採用
  const BUCKET_MS = 60_000 // 1分
  const buckets = new Map<number, number>() // bucketKey → steps per bucket

  for (const [start, end, steps] of intervals) {
    const durationMs = end - start
    if (durationMs <= 0) continue
    const stepsPerMs = steps / durationMs

    let t = start
    while (t < end) {
      const bucketKey = Math.floor(t / BUCKET_MS)
      const bucketEnd = Math.min((bucketKey + 1) * BUCKET_MS, end)
      const bucketSteps = stepsPerMs * (bucketEnd - t)

      const existing = buckets.get(bucketKey) ?? 0
      if (bucketSteps > existing) {
        buckets.set(bucketKey, bucketSteps)
      }
      t = bucketEnd
    }
  }

  let total = 0
  for (const steps of buckets.values()) {
    total += steps
  }
  return Math.round(total)
}
```

#### `sync-aggregate.ts` の集計部分

```typescript
// Before:
const stepsByDay = collapseDaySourceMax(stepsByDaySource)

// After:
const stepsByDay = new Map<string, number>()
for (const [day, intervals] of stepIntervalsByDay.entries()) {
  stepsByDay.set(day, mergedIntervalSteps(intervals))
}
```

**DistanceRecord, ActiveCaloriesBurnedRecord, TotalCaloriesBurnedRecord** も同様の問題がある可能性があるが、まずStepsRecordのみで効果を確認し、他は後で対応する。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/sync-parsers.ts` | `mergedIntervalSteps` 関数追加 |
| `cloudflare-api/src/handlers/sync-aggregate.ts` | StepsRecordの収集方法変更、区間マージによる集計 |

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```

デプロイ後:
1. `__meta__last_aggregated_at_ms` を0にリセット
2. API呼び出しで再集計
3. daily_metricsの歩数を確認

Google Fitの値との比較:
| 日付 | Google Fit | 目標 |
|------|-----------|------|
| 2/24 | 6,459 | ±15%以内 |
| 3/1 | 2,922 | ±15%以内 |
| 3/2 | 5,022 | ±15%以内 |
| 3/3 | 3,499 | ±15%以内 |
| 3/4 | 2,389 | ±15%以内 |
