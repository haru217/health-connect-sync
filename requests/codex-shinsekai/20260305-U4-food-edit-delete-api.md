# Request: 食事記録の編集・削除 API（U4）

- Date: 2026-03-05
- Owner: Codex-shinsekai
- Status: `pending`
- Phase: U（UX改善）
- Depends on: なし
- Priority: 高

## 概要

食事記録の編集・削除機能をバックエンドに追加する。合わせてフロントエンドのAPI関数も追加する。

## 1. `DELETE /api/food/:id` — 新規追加

### ファイル: `cloudflare-api/src/handlers/food.ts`

`handleFoodDelete` を追加:

```typescript
export async function handleFoodDelete(pathname: string, env: Env): Promise<Response> {
  const idStr = pathname.replace('/api/food/', '')
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ detail: 'Invalid food id' }, 400)
  }

  // 該当レコードを取得して日付を確認
  const row = await queryFirst<{ local_date: string }>(
    env.DB,
    'SELECT local_date FROM nutrition_events WHERE id = ?',
    [id],
  )
  if (!row) {
    return jsonResponse({ detail: 'Not found' }, 404)
  }

  await execute(env.DB, 'DELETE FROM nutrition_events WHERE id = ?', [id])
  await recalculateDailyIntakeKcal(env.DB, row.local_date)

  return jsonResponse({ ok: true, deleted_id: id })
}
```

## 2. `PUT /api/food/:id` — 新規追加

### ファイル: `cloudflare-api/src/handlers/food.ts`

`handleFoodUpdate` を追加:

```typescript
export async function handleFoodUpdate(pathname: string, request: Request, env: Env): Promise<Response> {
  const idStr = pathname.replace('/api/food/', '')
  const id = Number.parseInt(idStr, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ detail: 'Invalid food id' }, 400)
  }

  const existing = await queryFirst<{ local_date: string }>(
    env.DB,
    'SELECT local_date FROM nutrition_events WHERE id = ?',
    [id],
  )
  if (!existing) {
    return jsonResponse({ detail: 'Not found' }, 404)
  }

  let body: Record<string, unknown>
  try {
    body = await readJsonBody(request, 512_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }

  // 更新可能フィールドの取得（部分更新対応）
  const updates: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) {
    const name = readRequiredString(body.name, 'name')
    updates.push('label = ?')
    values.push(name)
  }
  if (body.amount !== undefined) {
    const amount = readRequiredString(body.amount, 'amount', 64)
    updates.push('unit = ?')
    values.push(amount)
  }
  if (body.kcal !== undefined) {
    updates.push('kcal = ?')
    values.push(toNumberOrNull(body.kcal))
  }
  if (body.protein_g !== undefined) {
    updates.push('protein_g = ?')
    values.push(toNumberOrNull(body.protein_g))
  }
  if (body.fat_g !== undefined) {
    updates.push('fat_g = ?')
    values.push(toNumberOrNull(body.fat_g))
  }
  if (body.carbs_g !== undefined) {
    updates.push('carbs_g = ?')
    values.push(toNumberOrNull(body.carbs_g))
  }
  if (body.micros_json !== undefined) {
    updates.push('micros_json = ?')
    values.push(typeof body.micros_json === 'string' ? body.micros_json : JSON.stringify(body.micros_json))
  }
  if (body.meal_type !== undefined) {
    const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
    const mt = typeof body.meal_type === 'string' ? body.meal_type.trim() : null
    updates.push('meal_type = ?')
    values.push(mt && VALID_MEAL_TYPES.includes(mt) ? mt : null)
  }

  if (updates.length === 0) {
    return jsonResponse({ detail: 'No fields to update' }, 400)
  }

  values.push(id)
  await execute(
    env.DB,
    `UPDATE nutrition_events SET ${updates.join(', ')} WHERE id = ?`,
    values,
  )

  await recalculateDailyIntakeKcal(env.DB, existing.local_date)

  return jsonResponse({ ok: true, updated_id: id })
}
```

注意: `readRequiredString` と `toNumberOrNull` は既にファイル内にある（ファイルスコープ関数）。`readJsonBody`, `execute`, `queryFirst`, `jsonResponse` は `../utils` からインポート済み。

## 3. ルーティング追加

### ファイル: `cloudflare-api/src/index.ts`

既存の food ルート群の下（`handleFoodHistory` の行の後）に追加:

```typescript
if (pathname.startsWith('/api/food/') && method === 'DELETE') return handleFoodDelete(pathname, env)
if (pathname.startsWith('/api/food/') && method === 'PUT') return handleFoodUpdate(pathname, request, env)
```

`import` に追加:
```typescript
import { handleFoodAnalyze, handleFoodConfirm, handleFoodHistory, handleFoodSearch, handleFoodDelete, handleFoodUpdate } from './handlers/food'
```

## 4. フロントエンドAPI関数

### ファイル: `web-app/src/api/food.ts`

以下2関数を追加:

```typescript
export async function deleteFood(id: string): Promise<void> {
    await apiFetch<void>(`/api/food/${id}`, { method: 'DELETE' })
}

export async function updateFood(
    id: string,
    data: { name?: string; amount?: string; kcal?: number; protein_g?: number; fat_g?: number; carbs_g?: number; meal_type?: string | null }
): Promise<void> {
    await apiFetch<void>(`/api/food/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}
```

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
cd web-app && npx tsc --noEmit
```

## デプロイ

```bash
cd cloudflare-api && npx wrangler deploy
```
