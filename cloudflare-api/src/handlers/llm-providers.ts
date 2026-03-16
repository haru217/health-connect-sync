import { DEFAULT_LLM_MODEL, LLM_TIMEOUT_MS, REPORT_EMOJI_RE } from '../constants'
import type {
  AnthropicMessageResponse,
  GeminiResponse,
  OpenAICompatibleResponse,
} from '../types'

export interface PlainTextConstraints {
  minChars: number
  maxChars: number
  forbidToday: boolean
}

export interface DailyReportGenerationResult {
  text: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
}

export function stripReportEmoji(value: string): string {
  return value.replace(REPORT_EMOJI_RE, '')
}

function normalizeGeneratedPlainText(value: string, field: string, constraints: PlainTextConstraints): string {
  const normalized = stripReportEmoji(value)
    // Avoid stripping useful markdown structure like bold or bullets here,
    // so the frontend can properly render the styled brief.
    .replace(/\r\n?/g, '\n')
    // Combine multiple newlines, but preserve paragraph breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) {
    throw new Error(`${field} must not be empty`)
  }
  if (normalized.length < constraints.minChars || normalized.length > constraints.maxChars) {
    throw new Error(`${field} length is out of range`)
  }
  if (constraints.forbidToday && normalized.includes('今日')) {
    throw new Error(`${field} must not include 今日`)
  }
  return normalized
}

async function callAnthropicDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let rawResponse = ''
  let responseStatus = 0
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    })
    responseStatus = response.status
    rawResponse = await response.text()
    if (!response.ok) {
      let detail = ''
      try {
        const parsed = JSON.parse(rawResponse) as Record<string, unknown>
        const err = parsed.error as Record<string, unknown> | undefined
        detail = typeof err?.message === 'string' ? `: ${err.message}` : ''
      } catch {
        // ignore parse failure
      }
      throw new Error(`Anthropic API error (${responseStatus})${detail}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsedResponse: AnthropicMessageResponse
  try {
    parsedResponse = JSON.parse(rawResponse) as AnthropicMessageResponse
  } catch {
    throw new Error('Anthropic API returned invalid JSON')
  }

  const textBlocks = (parsedResponse.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
    .map((item) => item.text as string)
  const generatedText = textBlocks.join('\n').trim()
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)
  return {
    text: normalizedText,
    model: typeof parsedResponse.model === 'string' ? parsedResponse.model : model,
    prompt_tokens:
      typeof parsedResponse.usage?.input_tokens === 'number' ? parsedResponse.usage.input_tokens : null,
    completion_tokens:
      typeof parsedResponse.usage?.output_tokens === 'number' ? parsedResponse.usage.output_tokens : null,
  }
}

async function callOpenAIDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

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
        max_completion_tokens: /^(gpt-5|o[1-9])/.test(model) ? 16384 : 1600,
        ...(/^(gpt-5|o[1-9])/.test(model) ? {} : { temperature: 0.5 }),
        messages: [
          { role: /^(gpt-5|o[1-9])/.test(model) ? 'developer' : 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
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
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)

  return {
    text: normalizedText,
    model: typeof parsed.model === 'string' ? parsed.model : model,
    prompt_tokens: typeof parsed.usage?.prompt_tokens === 'number' ? parsed.usage.prompt_tokens : null,
    completion_tokens: typeof parsed.usage?.completion_tokens === 'number' ? parsed.usage.completion_tokens : null,
  }
}

async function callGeminiDailyReport(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  const geminiModel = model || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`

  let rawResponse = ''
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.5,
        },
      }),
      signal: controller.signal,
    })
    rawResponse = await response.text()
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${rawResponse.slice(0, 200)}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  let parsed: GeminiResponse
  try {
    parsed = JSON.parse(rawResponse) as GeminiResponse
  } catch {
    throw new Error('Gemini API returned invalid JSON')
  }

  const parts = parsed.candidates?.[0]?.content?.parts ?? []
  const outputPart = [...parts].reverse().find((part) => !part.thought)
  const generatedText = (typeof outputPart?.text === 'string' ? outputPart.text : '').trim()
  const normalizedText = normalizeGeneratedPlainText(generatedText, 'briefing', constraints)
  return {
    text: normalizedText,
    model: parsed.modelVersion ?? geminiModel,
    prompt_tokens: typeof parsed.usageMetadata?.promptTokenCount === 'number' ? parsed.usageMetadata.promptTokenCount : null,
    completion_tokens: typeof parsed.usageMetadata?.candidatesTokenCount === 'number' ? parsed.usageMetadata.candidatesTokenCount : null,
  }
}

export async function callLlmPlainText(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  constraints: PlainTextConstraints,
): Promise<DailyReportGenerationResult> {
  if (provider === 'openai') {
    return callOpenAIDailyReport(apiKey, model || 'gpt-4o-mini', systemPrompt, userPrompt, constraints)
  }
  if (provider === 'gemini' || provider === 'google') {
    return callGeminiDailyReport(apiKey, model || 'gemini-2.5-flash', systemPrompt, userPrompt, constraints)
  }
  return callAnthropicDailyReport(apiKey, model || DEFAULT_LLM_MODEL, systemPrompt, userPrompt, constraints)
}
