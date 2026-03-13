# Request: food.ts セキュリティ・品質修正（H3v2）

- Date: 2026-03-04
- Owner: Codex-shinsekai
- Status: `open`
- Phase: H（ハルUX v2）
- Depends on: H3（food Gemini API）
- Priority: 高

## 概要

コードレビューで検出されたfood.tsのHIGH/MEDIUM問題を修正する。

## 修正内容

### HIGH-1: confirm の items 配列にサイズ制限を追加

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: `handleFoodConfirm()` L574付近

現状: `body.items` の長さチェックが「空でない」のみ。大量アイテム送信でDB負荷。

修正:
```typescript
const FOOD_CONFIRM_MAX_ITEMS = 20

// L574付近を変更
if (!Array.isArray(body.items) || body.items.length === 0) {
  return jsonResponse({ detail: 'items must be a non-empty array' }, 400)
}
if (body.items.length > FOOD_CONFIRM_MAX_ITEMS) {
  return jsonResponse({ detail: `items must not exceed ${FOOD_CONFIRM_MAX_ITEMS}` }, 400)
}
```

### HIGH-2: Gemini APIキーをURLからヘッダーに移行

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: `callGeminiFoodAnalyze()` L385付近

現状: APIキーがURLクエリパラメータに含まれ、ログ等に漏洩するリスク。

修正:
```typescript
// L385: URLからkeyパラメータを削除
const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// L388-389: headersにx-goog-api-keyを追加
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  // ... rest unchanged
})
```

### HIGH-3: image_base64 のサイズ制限追加

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: `parseInlineImage()` L313付近 または `handleFoodAnalyze()` L519付近

現状: 画像サイズの検証なし。巨大画像でメモリ消費・API呼び出しコスト増大。

修正: `handleFoodAnalyze()` で画像パース後にサイズチェック追加:
```typescript
const MAX_IMAGE_BASE64_LENGTH = 7_000_000  // ~5MB decoded

const image = parseInlineImage(body.image_base64)
if (image && image.base64Data.length > MAX_IMAGE_BASE64_LENGTH) {
  return jsonResponse({ detail: 'image_base64 is too large (max ~5MB)' }, 400)
}
```

### HIGH-4: Geminiエラー詳細のサニタイズ

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: `callGeminiFoodAnalyze()` L404 と `handleFoodAnalyze()` L546-552

現状:
- L404: `rawResponse.slice(0, 240)` がエラーメッセージに含まれ、クライアントに漏洩
- L426: 同様に `rawResponse.slice(0, 300)` が含まれる
- L546-552: `error.message` をそのままクライアントに返却

修正:

1. `callGeminiFoodAnalyze()` 内のエラーでは raw response を含めてよい（console.error用）が、`handleFoodAnalyze()` でクライアントに返す際にサニタイズ:

```typescript
// handleFoodAnalyze() L546-552 を変更
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to analyze meal'
  console.error(`food-analyze-error: ${message}`)
  // クライアントにはGemini内部詳細を返さない
  return jsonResponse({ detail: 'Failed to analyze meal. Please try again.' }, 502)
}
```

### MEDIUM-1: search クエリの長さ制限

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: `handleFoodSearch()` L628付近

修正:
```typescript
const FOOD_SEARCH_MAX_QUERY_LENGTH = 200

const query = (url.searchParams.get('q') ?? '').trim()
if (!query) {
  return jsonResponse({ detail: 'q query is required' }, 400)
}
if (query.length > FOOD_SEARCH_MAX_QUERY_LENGTH) {
  return jsonResponse({ detail: 'q query is too long' }, 400)
}
```

### MEDIUM-2: GEMINI_MODEL を定数から環境変数対応に

**ファイル**: `cloudflare-api/src/handlers/food.ts`
**場所**: L9, `callGeminiFoodAnalyze()`

修正: `callGeminiFoodAnalyze` の引数にmodelを追加し、`handleFoodAnalyze()` で `env.GEMINI_MODEL || 'gemini-2.0-flash'` を渡す:

```typescript
// 定数を削除し、デフォルト値のみ残す
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

// callGeminiFoodAnalyze のシグネチャ変更
async function callGeminiFoodAnalyze(
  apiKey: string,
  model: string,
  prompt: string,
  image: ParsedInlineImage | null,
): Promise<FoodItemNormalized[]> {
  // L385: model パラメータを使用
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  // ...
}

// handleFoodAnalyze() での呼び出し
const model = ((env as Record<string, unknown>).GEMINI_MODEL as string) || DEFAULT_GEMINI_MODEL
const items = await callGeminiFoodAnalyze(apiKey, model, prompt, image)
```

※ Env型にGEMINI_MODELを追加する場合は `cloudflare-api/src/types.ts` も修正。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cloudflare-api/src/handlers/food.ts` | 上記6件の修正 |

## Acceptance Criteria

1. confirm の items が21件以上で400エラーが返る
2. Gemini API呼び出しでURLにAPIキーが含まれない（headersで送信）
3. 5MB超の画像で400エラーが返る
4. Geminiエラー時にクライアントにraw responseが漏洩しない
5. search の q が200文字超で400エラーが返る
6. TypeScript ビルドが通る
