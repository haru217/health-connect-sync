# Request: 睡眠ステージの二重カウント修正（F1）

- Date: 2026-03-04
- Owner: Codex
- Status: `done`
- Phase: F（バグ修正）
- Depends on: なし
- Priority: 高（チャート表示が壊れている）

## 症状

睡眠タブの「睡眠時間の推移」チャートで 3/3 に **17時間** が表示される。
stacked bar（深い/浅い/レム）の合計値が異常に大きい。

## 根本原因

`cloudflare-api/src/handlers/health.ts` の `collectSleepRecordStatsByDay()` 関数（L280-352）。

同じ日に複数の睡眠セッション（重複するHealth Connectレコード）がある場合:

1. **`sleep_minutes`**: L344 で `mergedIntervalMinutes()` により正しくマージされる → OK
2. **`deep_min` / `light_min` / `rem_min`**: L326-328 で**単純加算のまま** → バグ

```typescript
// L325-328: 重複セッションのステージ分数を単純加算（バグ）
existing.sleep_minutes += totalSleepMinutes  // ← 後でマージされるからOK
existing.deep_min += breakdown.deep_min      // ← マージされない！二重カウント
existing.light_min += breakdown.light_min    // ← 同上
existing.rem_min += breakdown.rem_min        // ← 同上
```

L344の最終化:
```typescript
sleep_minutes: stats.intervals.length > 0 ? mergedIntervalMinutes(stats.intervals) : stats.sleep_minutes,
deep_min: stats.deep_min,      // ← 二重カウントされた値がそのまま出力
light_min: stats.light_min,    // ← 同上
rem_min: stats.rem_min,        // ← 同上
```

チャートは `deep_h + light_h + rem_h` のstacked barなので、ステージ合計が17hになる。

## 対照: 正しい実装

`cloudflare-api/src/handlers/sync-aggregate.ts` の `mergedIntervalMinutes()` は重複を正しくマージしている。
しかしこれはインターバルベースの関数で、ステージ別の分数マージには使えない。

## 修正方針

ステージ分数の重複を除去する。以下のいずれかのアプローチ:

### 案A: マージ比率で按分（推奨）

最終化フェーズで、マージ済み `sleep_minutes` とステージ合計の比率で按分する:

```typescript
const finalizedByDay = new Map<string, SleepRecordDailyStats>()
for (const [day, stats] of byDay.entries()) {
  const mergedSleep = stats.intervals.length > 0
    ? mergedIntervalMinutes(stats.intervals)
    : stats.sleep_minutes
  const rawTotal = stats.deep_min + stats.light_min + stats.rem_min
  // ステージ合計がマージ後の睡眠時間を超えていたら按分で補正
  const ratio = rawTotal > 0 && rawTotal > mergedSleep
    ? mergedSleep / rawTotal
    : 1
  finalizedByDay.set(day, {
    sleep_minutes: mergedSleep,
    deep_min: Math.round(stats.deep_min * ratio),
    light_min: Math.round(stats.light_min * ratio),
    rem_min: Math.round(stats.rem_min * ratio),
    bedtime: stats.bedtime,
    wake_time: stats.wake_time,
    latest_end_ms: stats.latest_end_ms,
  })
}
```

### 案B: 最新セッションのステージのみ使用

重複セッションがある場合、`latest_end_ms` が最新のセッションのステージ値のみを使う。
シンプルだが、マージされた複数の有効セッションのステージ情報が失われる。

### 連鎖バグ: 年表示の月バケット集約（L415-418）

同ファイルの `getSleepData()` 内、年表示時に日→月バケットを集約する箇所:

```typescript
// L415-418: 日次のステージ値を月バケットに単純加算
existing.sleep_minutes += stats.sleep_minutes  // ← L344で補正済みの値なのでOK
existing.deep_min += stats.deep_min            // ← L345の未補正値が入力 → 二重カウント伝播
existing.light_min += stats.light_min          // ← 同上
existing.rem_min += stats.rem_min              // ← 同上
```

案Aの修正でL345-347が補正されれば、こちらへの入力も正しくなり**自動的に解決**される。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/health.ts` | `collectSleepRecordStatsByDay()` の最終化フェーズでステージ分数を補正 |

※ フロントエンド変更なし

## 制約

1. `sleep_minutes` のマージロジック（L344）は変更しない（正しく動作中）
2. `sync-aggregate.ts` 側の `daily_metrics` 更新ロジックは変更しない
3. TypeScript ビルドが通ること
4. 本番デプロイはしない（ローカル確認のみ）

## 確認方法

ローカルで `wrangler dev` を起動し、`/api/sleep-data?date=2026-03-03&segment=week` を叩いて:
- 3/3 の `sleep_minutes` が妥当な値（7-9時間程度）
- `deep_min + light_min + rem_min` ≤ `sleep_minutes` であること
- stacked barチャートが17hではなく正常な高さで表示されること

## Acceptance Criteria

1. 重複睡眠セッションがある日のステージ合計が `sleep_minutes` を超えない
2. チャートの stacked bar が妥当な高さで表示される
3. ステージがない日（ステージ全てnull）の挙動に影響しない
4. TypeScript ビルドが通る
5. 本番デプロイはしない
