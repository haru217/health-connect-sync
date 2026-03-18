# Request: 食事解析をOpenAI GPT-5.4 miniに対応（G1）

- Date: 2026-03-18
- Owner: Codex
- Status: `done`
- Phase: G（GPTプロバイダー移行）
- Depends on: なし
- Priority: 高

## 背景

食事解析（`/api/food/analyze`）は現在Gemini Flash専用だが、画像解析テストでGPT-5.4 miniが同等以上の精度を示した（5品識別・微量栄養素19/19）。Gemini APIの画像処理でエラーが発生しており、OpenAI対応が必要。

**根本課題**: 現在のプロンプト `"Return all available nutrients, and set unknown values to null"` はGeminiでは機能するが、GPTは保守的に解釈し微量栄養素を全てnullにする。プロンプト改善で解決済み（テスト実証済み）。

## 変更1: プロンプト改善（buildAnalyzePrompt）

`cloudflare-api/src/handlers/food.ts` の `buildAnalyzePrompt` 関数（354行目付近）を修正。

現在:
```typescript
'Return all available nutrients, and set unknown values to null.',
```

変更後:
```typescript
'For chain restaurants, prioritize official nutrition data when available.',
'For general foods, use standard Japanese food composition references (文科省食品成分表).',
'',
'IMPORTANT: ALWAYS estimate micronutrients based on the ingredients and cooking method.',
'Use Japanese food composition tables as reference for estimation.',
'Do NOT return null for common nutrients like sodium, potassium, calcium, iron, zinc, fiber, or B vitamins — these can always be estimated from ingredients.',
'Only return null for nutrients that truly cannot be estimated from the given information.',
```

`'For chain restaurants...'` と `'For general foods...'` の既存2行は上記に統合されるので重複削除すること。

## 変更2: OpenAI食事解析関数の追加

`cloudflare-api/src/handlers/food.ts` に `callOpenAIFoodAnalyze` 関数を追加。

```typescript
async function callOpenAIFoodAnalyze(
  apiKey: string,
  model: string,
  prompt: string,
  image: ParsedInlineImage | null,
): Promise<GeminiFoodAnalyzeResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  if (image) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64Data}`,
        detail: 'high',
      },
    })
  }

  let rawResponse = ''
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4096,
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${rawResponse.slice(0, 240)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: OpenAICompatibleResponse
  try {
    parsed = JSON.parse(rawResponse) as OpenAICompatibleResponse
  } catch {
    throw new Error('OpenAI API returned invalid JSON')
  }

  const generatedText = parsed.choices?.[0]?.message?.content?.trim() ?? ''
  if (!generatedText) {
    throw new Error('OpenAI returned empty content')
  }

  return {
    items: parseGeminiFoodItems(generatedText),  // JSON構造は同じなので再利用可能
    promptTokens: typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : 0,
    completionTokens: typeof parsed.usage?.completion_tokens === 'number' ? parsed.usage.completion_tokens : 0,
  }
}
```

import文に `OpenAICompatibleResponse` を追加:
```typescript
import type { D1Database, Env, GeminiResponse, NutritionEventRow, OpenAICompatibleResponse } from '../types'
```

## 変更3: handleFoodAnalyzeのプロバイダールーティング

`handleFoodAnalyze`（534行目付近）を修正。現在のGemini固定ロジックをプロバイダー切替に変更。

現在:
```typescript
const apiKey = (env.GEMINI_API_KEY ?? '').trim()
if (!apiKey) {
  return jsonResponse({ detail: 'GEMINI_API_KEY is not configured' }, 503)
}
const model = (env.GEMINI_MODEL ?? '').trim() || DEFAULT_GEMINI_MODEL
const prompt = buildAnalyzePrompt(text)
const limitCheck = await checkMonthlyLimit(env.DB)
if (!limitCheck.ok) {
  return jsonResponse({ ... }, 429)
}
try {
  const result = await callGeminiFoodAnalyze(apiKey, model, prompt, image)
  ...
}
```

変更後:
```typescript
const provider = ((env.FOOD_LLM_PROVIDER ?? env.LLM_PROVIDER) as string ?? '').trim().toLowerCase() || 'gemini'
const prompt = buildAnalyzePrompt(text)

let result: GeminiFoodAnalyzeResult
if (provider === 'openai') {
  const apiKey = (env.LLM_API_KEY ?? '').trim()
  if (!apiKey) {
    return jsonResponse({ detail: 'LLM_API_KEY is not configured' }, 503)
  }
  const model = (env.FOOD_LLM_MODEL ?? env.LLM_MODEL ?? '').trim() || 'gpt-5.4-mini'
  try {
    result = await callOpenAIFoodAnalyze(apiKey, model, prompt, image)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze meal'
    console.error(`food-analyze-error: ${message}`)
    return jsonResponse({ detail: 'Failed to analyze meal' }, 502)
  }
} else {
  const apiKey = (env.GEMINI_API_KEY ?? '').trim()
  if (!apiKey) {
    return jsonResponse({ detail: 'GEMINI_API_KEY is not configured' }, 503)
  }
  const model = (env.GEMINI_MODEL ?? '').trim() || DEFAULT_GEMINI_MODEL
  const limitCheck = await checkMonthlyLimit(env.DB)
  if (!limitCheck.ok) {
    return jsonResponse({
      detail: 'Gemini API の月額上限に達しました。食品DBからの検索は引き続き利用できます。',
      current_cost_jpy: limitCheck.currentCostJpy,
      limit_jpy: limitCheck.limitJpy,
    }, 429)
  }
  try {
    result = await callGeminiFoodAnalyze(apiKey, model, prompt, image)
    try {
      await recordGeminiUsage(env.DB, result.promptTokens, result.completionTokens)
    } catch {
      // Usage tracking failure should not block response delivery.
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze meal'
    console.error(`food-analyze-error: ${message}`)
    return jsonResponse({ detail: 'Failed to analyze meal' }, 502)
  }
}

return jsonResponse({
  source: provider === 'openai' ? 'openai' : 'gemini',
  items: result.items.map((item) => toFoodResponseItem(item)),
})
```

## 変更4: Env型にFOOD_LLM_PROVIDER追加

`cloudflare-api/src/types.ts` の `Env` インターフェースに追加:
```typescript
FOOD_LLM_PROVIDER?: string
FOOD_LLM_MODEL?: string
```

## 変更しないもの

- `wrangler.toml`: 現状の `LLM_PROVIDER=openai` がそのまま食事解析にも適用される。将来 `FOOD_LLM_PROVIDER` で個別指定も可能
- DBマイグレーション: 不要
- テスト: 既存の型チェックのみ

## 変更ファイル

- `cloudflare-api/src/handlers/food.ts` — プロンプト改善、OpenAI関数追加、プロバイダールーティング
- `cloudflare-api/src/types.ts` — Envに `FOOD_LLM_PROVIDER`, `FOOD_LLM_MODEL` 追加

## 検証

```bash
cd cloudflare-api && npx tsc --noEmit
```
