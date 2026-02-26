# Iteration 5 — Codex 用指示書（/api/connection-status + profile ゴール列）

## 背景

Iteration 5 ではマイ画面の「Health Connect 連携状況」表示と「目標設定」のための実装を追加する。
バックエンドは **`cloudflare-api/src/index.ts`（Cloudflare Workers + D1）**。
`pc-server/`（Python）は旧バックエンドのため触らないこと。

## ローカル開発

```bash
cd cloudflare-api
npx wrangler dev
```

ベース URL: `http://localhost:8787`

---

## タスク 1: `/api/connection-status` エンドポイント追加

### 対象ファイル

`cloudflare-api/src/index.ts`

### 追加場所

`/api/profile` PUT ブロックの直後（`/api/nutrients/targets` の前）に挿入する。

### 実装

```typescript
if (pathname === '/api/connection-status' && method === 'GET') {
  const lastSync = await queryFirst<{ received_at: string }>(
    env.DB,
    'SELECT received_at FROM sync_runs ORDER BY received_at DESC LIMIT 1',
  )
  const total = await queryFirst<{ c: number }>(
    env.DB,
    'SELECT COUNT(*) AS c FROM health_records',
  )
  const weight = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='WeightRecord' LIMIT 1",
  )
  const sleep = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='SleepSessionRecord' LIMIT 1",
  )
  const activity = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='StepsRecord' LIMIT 1",
  )
  const vitals = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type IN ('BloodPressureRecord','RestingHeartRateRecord') LIMIT 1",
  )
  return jsonResponse({
    last_sync_at: lastSync?.received_at ?? null,
    total_records: total?.c ?? 0,
    has_weight_data: (weight?.c ?? 0) > 0,
    has_sleep_data: (sleep?.c ?? 0) > 0,
    has_activity_data: (activity?.c ?? 0) > 0,
    has_vitals_data: (vitals?.c ?? 0) > 0,
  })
}
```

### レスポンス例

```json
{
  "last_sync_at": "2026-02-25T08:30:00+09:00",
  "total_records": 12450,
  "has_weight_data": true,
  "has_sleep_data": true,
  "has_activity_data": true,
  "has_vitals_data": false
}
```

---

## タスク 2: `/api/profile` にゴール列を追加

### マイグレーション

`cloudflare-api/migrations/` に新しいファイルを追加する（既存ファイルの番号を確認して次の番号にする）：

```sql
-- migrations/0002_profile_goals.sql  ← 番号は既存に合わせて調整
ALTER TABLE user_profile ADD COLUMN sleep_goal_minutes INTEGER DEFAULT 420;
ALTER TABLE user_profile ADD COLUMN steps_goal INTEGER DEFAULT 8000;
```

適用：

```bash
npx wrangler d1 migrations apply health_connect_sync --remote
```

### `ProfileRow` 型に追記

`index.ts` 内の `ProfileRow` 型定義（`interface ProfileRow` または `type ProfileRow`）に追加：

```typescript
sleep_goal_minutes?: number | null
steps_goal?: number | null
```

### GET の修正

`/api/profile` GET のレスポンスに2フィールドを追加：

```typescript
return jsonResponse({
  name: row.name ?? undefined,
  height_cm: row.height_cm ?? undefined,
  birth_year: row.birth_year ?? undefined,
  sex: row.sex ?? undefined,
  goal_weight_kg: row.goal_weight_kg ?? undefined,
  sleep_goal_minutes: row.sleep_goal_minutes ?? 420,
  steps_goal: row.steps_goal ?? 8000,
})
```

### PUT の修正

`upsertProfile` 関数（または PUT ブロック内の SQL）で `sleep_goal_minutes` / `steps_goal` を受け取って保存できるように追加する。

---

## 動作確認

```bash
# wrangler dev 起動中に実行

curl -s -H "X-Api-Key: test12345" http://localhost:8787/api/connection-status

curl -s -H "X-Api-Key: test12345" http://localhost:8787/api/profile

curl -s -X PUT -H "X-Api-Key: test12345" -H "Content-Type: application/json" \
  -d '{"sleep_goal_minutes": 450, "steps_goal": 10000}' \
  http://localhost:8787/api/profile
```

---

## 注意事項

- `queryFirst` / `jsonResponse` / `isAuthorized` は既存のヘルパーを使う（追加不要）
- 既存エンドポイントの動作を壊さないこと
- `pc-server/` は触らないこと
