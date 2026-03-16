import type { Segment } from '../components/SegmentSelector'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function formatXLabel(dateStr: string, segment: Segment): string {
  if (!dateStr) return ''
  if (segment === 'week') {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number)
      return WEEKDAYS[new Date(y, m - 1, d).getDay()]
    }
    return dateStr
  }
  if (segment === 'year') {
    const parts = dateStr.split('-')
    if (parts.length >= 2) return `${parseInt(parts[1], 10)}月`
    return dateStr
  }
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10)
    const d = parseInt(parts[2], 10)
    return `${m}/${d}`
  }
  return dateStr
}

export function formatTooltipLabel(dateStr: string, segment: Segment): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (segment === 'week' || segment === 'month') {
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number)
      const w = WEEKDAYS[new Date(y, m - 1, d).getDay()]
      return `${m}/${d} (${w})`
    }
  }
  if (segment === 'year') {
    if (parts.length >= 2) return `${parseInt(parts[0], 10)}年${parseInt(parts[1], 10)}月`
  }
  return dateStr
}

export function formatRounded(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits)
}

export function weekDayOfIsoDate(dateStr: string): number | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3) return null
  const [y, m, d] = parts
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return new Date(y, m - 1, d).getDay()
}

export function monthTickDates(dates: string[], anchorDate: string): string[] {
  const anchorDay = weekDayOfIsoDate(anchorDate)
  if (anchorDay == null) return []
  return dates.filter((dateStr) => weekDayOfIsoDate(dateStr) === anchorDay)
}

export function joinAdviceSentences(sentences: string[]): string | null {
  const normalized = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/。+$/u, ''))
  if (normalized.length === 0) return null
  return `${normalized.join('。')}。`
}
