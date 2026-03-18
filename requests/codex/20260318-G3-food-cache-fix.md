# Request: 食事解析のキャッシュヒット改善+微量栄養素補完（G3）

- Date: 2026-03-18
- Owner: Codex
- Status: `done`
- Phase: G（GPTプロバイダー移行）
- Depends on: G2（完了済み）
- Priority: 高

## 背景

G2のE2Eテストで2つの問題が発見された:

### 問題1: DBキャッシュがヒットしない

ユーザー入力「マクドナルド ビッグマック」に対して:
- 保存データ: `name='ビッグマック'`, `brand='マクドナルド'`
- 検索SQL: `WHERE name LIKE '%マクドナルド ビッグマック%'`
- → nameカラムに「マクドナルド」が含まれないのでヒットしない

### 問題2: web検索モードで微量栄養素がnullになる

web検索は公式サイトのマクロ栄養素（kcal/P/F/C/salt）だけ返し、微量栄養素を全てnullにする。
- 吉野家: micros 0/36
- ビッグマック: micros 12/36（マクドナルドは一部公開しているため）

## 修正1: queryFoodItemsLike の検索改善

`cloudflare-api/src/handlers/food.ts` の `queryFoodItemsLike` 関数（303行目付近）を修正。

入力テキストをスペースで分割し、各単語がname OR brandのどちらかにマッチすればヒットするようにする。

現在:
```typescript
async function queryFoodItemsLike(db: D1Database, text: string, limit: number): Promise<FoodDbRow[]> {
  const like = `%${escapeLike(text)}%`
  return queryAll<FoodDbRow>(
    db,
    `
    SELECT
      id, name, brand, amount, kcal, protein_g, fat_g, carbs_g, micros_json,
      source, verified, use_count, last_used_at
    FROM food_items
    WHERE name LIKE ? ESCAPE '\\' OR COALESCE(brand, '') LIKE ? ESCAPE '\\'
    ORDER BY use_count DESC, last_used_at DESC, id DESC
    LIMIT ?
    `,
    [like, like, limit],
  )
}
```

変更後:
```typescript
async function queryFoodItemsLike(db: D1Database, text: string, limit: number): Promise<FoodDbRow[]> {
  // スペースで分割して各トークンでAND検索（各トークンはname OR brandにマッチ）
  const tokens = text.trim().split(/\s+/).filter((t) => t.length > 0)
  if (tokens.length === 0) {
    return []
  }

  const conditions: string[] = []
  const params: unknown[] = []
  for (const token of tokens) {
    const like = `%${escapeLike(token)}%`
    conditions.push(`(name LIKE ? ESCAPE '\\' OR COALESCE(brand, '') LIKE ? ESCAPE '\\')`)
    params.push(like, like)
  }

  return queryAll<FoodDbRow>(
    db,
    `
    SELECT
      id, name, brand, amount, kcal, protein_g, fat_g, carbs_g, micros_json,
      source, verified, use_count, last_used_at
    FROM food_items
    WHERE ${conditions.join(' AND ')}
    ORDER BY use_count DESC, last_used_at DESC, id DESC
    LIMIT ?
    `,
    [...params, limit],
  )
}
```

これにより「マクドナルド ビッグマック」は:
- token1「マクドナルド」→ brand LIKE '%マクドナルド%' ✓
- token2「ビッグマック」→ name LIKE '%ビッグマック%' ✓
- AND条件で結合 → ヒット ✓

## 修正2: web検索後に微量栄養素を補完

web検索結果のmicrosがほぼnullの場合、追加でChat Completions APIを呼んで微量栄養素を推定補完する。

`handleFoodAnalyze` のOpenAI + web検索ブランチ内、`callOpenAIFoodAnalyzeWithSearch` の後に以下のロジックを追加:

```typescript
// web検索結果の微量栄養素がほぼnullなら、LLM推定で補完
for (const item of result.items) {
  const micros = item.micros
  const nullCount = MICRO_KEYS.filter((key) => micros[key] === null || micros[key] === undefined).length
  if (nullCount > MICRO_KEYS.length / 2) {
    // 半数以上nullなら補完を試みる
    try {
      const supplementPrompt = buildAnalyzePrompt(
        `${item.brand ? item.brand + ' ' : ''}${item.name} ${item.amount ?? ''}`.trim(),
      )
      const supplementResult = await callOpenAIFoodAnalyze(apiKey, model, supplementPrompt, null)
      if (supplementResult.items.length > 0) {
        const supplementMicros = supplementResult.items[0].micros
        // nullの項目だけ補完（web検索で得た値は上書きしない）
        for (const key of MICRO_KEYS) {
          if ((micros[key] === null || micros[key] === undefined) && supplementMicros[key] != null) {
            micros[key] = supplementMicros[key]
          }
        }
      }
    } catch {
      // 補完失敗はブロックしない
    }
  }
}
```

これにより:
1. web検索でマクロ栄養素（公式値）を取得
2. 微量栄養素がnullの項目をLLM推定で補完
3. 合体した結果をDBにキャッシュ

**コスト**: web検索1回 + LLM補完1回 = 初回のみ追加コスト（$0.02 + $0.001程度）。2回目以降はDBキャッシュで0。

## 変更ファイル

- `cloudflare-api/src/handlers/food.ts` — queryFoodItemsLike改善、微量栄養素補完ロジック追加

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```
