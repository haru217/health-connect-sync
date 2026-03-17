import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER } from '../constants'
import type { Env } from '../types'
import { jsonResponse } from '../utils'

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  claude: 'Claude',
  gemini: 'Gemini',
}

function toTitleCase(value: string): string {
  if (!value) {
    return value
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function toModelDisplayName(model: string): string {
  const trimmed = model.trim()
  if (!trimmed) {
    return 'Unknown model'
  }

  const rawParts = trimmed.split('-').filter(Boolean)
  const parts =
    rawParts.length > 1 && /^\d{8}$/.test(rawParts[rawParts.length - 1])
      ? rawParts.slice(0, -1)
      : rawParts
  if (parts.length === 0) {
    return trimmed
  }

  const [provider, ...rest] = parts
  const label = PROVIDER_LABELS[provider] ?? toTitleCase(provider)
  const words: string[] = []
  let version = ''

  for (const token of rest) {
    if (/^\d+$/.test(token)) {
      version = version ? `${version}.${token}` : token
      continue
    }
    if (version) {
      words.push(version)
      version = ''
    }
    words.push(toTitleCase(token))
  }
  if (version) {
    words.push(version)
  }

  return [label, ...words].join(' ').trim()
}

export async function handleAiConfigGet(env: Env): Promise<Response> {
  const provider = (env.LLM_PROVIDER ?? DEFAULT_LLM_PROVIDER).trim() || DEFAULT_LLM_PROVIDER
  const model = (env.LLM_MODEL ?? DEFAULT_LLM_MODEL).trim() || DEFAULT_LLM_MODEL
  return jsonResponse({
    provider,
    model,
    display_name: toModelDisplayName(model),
  })
}
