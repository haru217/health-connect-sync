function sanitizeConfigValue(value: string): string {
  return value.replace(/^\uFEFF/, '').trim()
}

function sanitizeHeaderValue(value: string): string {
  return sanitizeConfigValue(value).replace(/[\r\n]/g, '')
}

const BASE_URL = sanitizeConfigValue(import.meta.env.VITE_API_URL ?? 'http://localhost:8765')
const API_KEY = sanitizeHeaderValue(import.meta.env.VITE_API_KEY ?? '')

type HeaderInitLike = HeadersInit | undefined

function mergeHeaders(extraHeaders: HeaderInitLike): Headers {
  const headers = new Headers(extraHeaders)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (API_KEY) {
    headers.set('X-Api-Key', API_KEY)
  }
  return headers
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: mergeHeaders(options.headers),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ${text || response.statusText}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export { BASE_URL }
