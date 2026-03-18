# Request: 食事解析にweb検索+自動キャッシュを追加（G2）

- Date: 2026-03-18
- Owner: Codex
- Status: `done`
- Phase: G（GPTプロバイダー移行）
- Depends on: G1（完了済み）
- Priority: 高

## 背景

G1でOpenAI GPT-5.4 miniによる食事解析を実装したが、LLM推定のみでは公式栄養データとの乖離がある（特にナトリウムが公式値の2倍になるケースあり）。OpenAI Responses API の web_search ツールを使えば、チェーン店の公式栄養データをwebから取得して正確な値を返せる。

テスト結果:
- LLM推定のみ: kcal 652, 食塩 4.6g（公式 635kcal, 2.5g）
- web検索付き: kcal 633, 食塩 2.5g（公式値に一致）、出典URL付き

ただしweb検索は入力トークンが59倍（461→27,103）になるため、結果をDBに自動キャッシュし、2回目以降はDB返却で0コストにする。

## 変更1: Responses API + web_search 関数の追加

`cloudflare-api/src/handlers/food.ts` に `callOpenAIFoodAnalyzeWithSearch` 関数を追加。

```typescript
async function callOpenAIFoodAnalyzeWithSearch(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<GeminiFoodAnalyzeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: 'JP',
            },
          },
        ],
        input: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI Responses API error (${response.status}): ${rawResponse.slice(0, 240)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawResponse) as Record<string, unknown>
  } catch {
    throw new Error('OpenAI Responses API returned invalid JSON')
  }

  // Extract text from output
  const output = parsed.output as Array<Record<string, unknown>> | undefined
  let generatedText = ''
  for (const item of output ?? []) {
    if (item.type === 'message') {
      const content = item.content as Array<Record<string, unknown>> | undefined
      for (const c of content ?? []) {
        if (c.type === 'output_text' && typeof c.text === 'string') {
          generatedText = c.text.trim()
        }
      }
    }
  }
  if (!generatedText) {
    throw new Error('OpenAI Responses API returned empty content')
  }

  // Extract JSON from possibly markdown-wrapped response
  let jsonText = generatedText
  const fenced = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced?.[1]) {
    jsonText = fenced[1]
  } else if (!jsonText.startsWith('{')) {
    const start = jsonText.indexOf('{')
    const end = jsonText.lastIndexOf('}')
    if (start >= 0 && end > start) {
      jsonText = jsonText.slice(start, end + 1)
    }
  }

  // Extract usage
  const usage = parsed.usage as Record<string, unknown> | undefined
  const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : 0
  const outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0

  return {
    items: parseGeminiFoodItems(jsonText),
    promptTokens: inputTokens,
    completionTokens: outputTokens,
  }
}
```

**注意**: この関数は画像入力を受け取らない（web_searchとの併用時はテキストのみ）。画像付きリクエストの場合は既存の `callOpenAIFoodAnalyze`（Chat Completions API）を使う。

## 変更2: web検索用プロンプト

`buildWebSearchPrompt` 関数を新規追加:

```typescript
function buildWebSearchPrompt(userText: string): string {
  const schemaLines = MICRO_KEYS.map((key) => `        "${key}": number | null`).join('\n')
  return [
    `Search the web for the official nutrition data of "${userText}" and return it as JSON.`,
    'Prioritize the official restaurant website or reliable nutrition databases.',
    'Use the exact official values - do not estimate or round.',
    '',
    'IMPORTANT: For micronutrients not available from official sources,',
    'estimate based on Japanese food composition tables (文科省食品成分表) and the known ingredients.',
    'Do NOT return null for common nutrients like sodium, potassium, calcium, iron, zinc, fiber, or B vitamins.',
    '',
    'Return ONLY a JSON object (no markdown, no explanation):',
    '{',
    '  "items": [',
    '    {',
    '      "name": "Food name",',
    '      "brand": "Brand name or null",',
    '      "amount": "Serving amount (e.g., 1 bowl, 200g)",',
    '      "kcal": number,',
    '      "protein_g": number,',
    '      "fat_g": number,',
    '      "carbs_g": number,',
    '      "micros": {',
    schemaLines,
    '      }',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}
```

## 変更3: handleFoodAnalyze のフロー変更

現在のフロー:
```
テキスト → DB検索 → なし → LLM推定
```

新フロー:
```
テキスト → DB検索 → なし → web検索(テキストのみ) → 結果をDBに自動保存 → 返却
テキスト+画像 → DB検索 → なし → LLM推定(画像対応) → 返却
画像のみ → LLM推定(画像対応) → 返却
```

`handleFoodAnalyze` の LLM呼び出し部分（provider === 'openai' ブランチ）を以下のように修正:

```typescript
if (provider === 'openai') {
  const apiKey = (env.LLM_API_KEY ?? '').trim()
  if (!apiKey) {
    return jsonResponse({ detail: 'LLM_API_KEY is not configured' }, 503)
  }
  const model = (env.FOOD_LLM_MODEL ?? env.LLM_MODEL ?? '').trim() || 'gpt-5.4-mini'

  try {
    // テキストのみで画像なし → web検索で公式データ取得
    if (text && !image) {
      result = await callOpenAIFoodAnalyzeWithSearch(apiKey, model, buildWebSearchPrompt(text))
      // web検索結果をDBに自動キャッシュ（次回からDB返却になる）
      for (const item of result.items) {
        try {
          await upsertFavoriteFoodItem(env.DB, item)
        } catch {
          // キャッシュ保存失敗はレスポンスをブロックしない
        }
      }
    } else {
      // 画像あり → Chat Completions API（web_searchは画像非対応）
      result = await callOpenAIFoodAnalyze(apiKey, model, buildAnalyzePrompt(text), image)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze meal'
    console.error(`food-analyze-error: ${message}`)
    return jsonResponse({ detail: 'Failed to analyze meal' }, 502)
  }
}
```

## 変更4: upsertFavoriteFoodItem の source を動的に

現在 `source` が `'gemini'` ハードコードされている。`source` パラメータを追加:

```typescript
async function upsertFavoriteFoodItem(
  db: D1Database,
  item: FoodItemNormalized,
  source: string = 'gemini',
): Promise<void> {
```

INSERT文の `'gemini'` を `source` パラメータに変更。

`handleFoodAnalyze` からの呼び出し時は `'web_search'` を渡す:
```typescript
await upsertFavoriteFoodItem(env.DB, item, 'web_search')
```

## 変更しないもの

- DBスキーマ: `food_items` テーブルの既存カラムで対応可能（`source` カラムは既に存在）
- 画像解析フロー: 画像付きの場合は従来通りChat Completions API
- Geminiフォールバック: `LLM_PROVIDER=gemini` の場合は従来通り

## 変更ファイル

- `cloudflare-api/src/handlers/food.ts` — web検索関数追加、フロー変更、自動キャッシュ、source動的化

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```
