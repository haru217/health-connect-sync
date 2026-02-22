import { useEffect, useState } from 'react'
import { fetchSummary } from '../api/healthApi'
import type { RequestState, SummaryResponse } from '../api/types'
import './HomeScreen.css'

interface HomeMetrics {
  insight: string
  weightKg: number | null
  steps: number | null
  sleepHours: number | null
  calorieBalance: number | null
}

function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function findTodayOrLatest<T extends { date: string }, K extends keyof T>(
  series: T[],
  valueKey: K,
): number | null {
  if (series.length === 0) {
    return null
  }
  const today = todayLocal()
  const todayPoint = series.find((item) => item.date === today)
  if (todayPoint && typeof todayPoint[valueKey] === 'number') {
    return Number(todayPoint[valueKey])
  }
  const latest = series[series.length - 1]
  return typeof latest[valueKey] === 'number' ? Number(latest[valueKey]) : null
}

function toHomeMetrics(summary: SummaryResponse): HomeMetrics {
  return {
    insight: summary.insights[0]?.message ?? '最新データを同期するとここに一言アドバイスが表示されます。',
    weightKg: findTodayOrLatest(summary.weightByDate, 'kg'),
    steps: findTodayOrLatest(summary.stepsByDate, 'steps'),
    sleepHours: findTodayOrLatest(summary.sleepHoursByDate, 'hours'),
    calorieBalance: findTodayOrLatest(summary.calorieBalanceByDate, 'kcal'),
  }
}

function formatNullable(value: number | null, digits = 0): string {
  if (value == null) {
    return '--'
  }
  return value.toLocaleString('ja-JP', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

export default function HomeScreen() {
  const [state, setState] = useState<RequestState<HomeMetrics>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const summary = await fetchSummary()
        if (!alive) {
          return
        }
        setState({ status: 'success', data: toHomeMetrics(summary) })
      } catch (error) {
        if (!alive) {
          return
        }
        const message = error instanceof Error ? error.message : '不明なエラー'
        setState({ status: 'error', error: message })
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="home-container fade-in">
        <div className="card">読み込み中...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="home-container fade-in">
        <div className="card">読み込みエラー: {state.error}</div>
      </div>
    )
  }

  const metrics = state.data
  const calorieText =
    metrics.calorieBalance == null
      ? '--'
      : `${metrics.calorieBalance > 0 ? '+' : ''}${formatNullable(metrics.calorieBalance, 0)}`

  return (
    <div className="home-container fade-in">
      <div className="ai-character-section card sticky-ai">
        <div className="ai-avatar ripple">
          <span role="img" aria-label="advisor" className="ai-emoji">
            👩‍⚕️
          </span>
        </div>
        <div className="ai-message">
          <p className="greeting">こんにちは！</p>
          <p className="insight">{metrics.insight}</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card card ripple stagger-1">
          <div className="metric-header">
            <span className="metric-icon">⚖️</span>
            <span className="metric-title">体重</span>
          </div>
          <div className="metric-value num">
            {formatNullable(metrics.weightKg, 1)} <span className="metric-unit">kg</span>
          </div>
          <div className="metric-trend good">最新</div>
        </div>

        <div className="metric-card card ripple stagger-2">
          <div className="metric-header">
            <span className="metric-icon">👟</span>
            <span className="metric-title">歩数</span>
          </div>
          <div className="metric-value num">
            {formatNullable(metrics.steps, 0)} <span className="metric-unit">歩</span>
          </div>
          <div className="metric-trend good">本日</div>
        </div>

        <div className="metric-card card ripple stagger-3">
          <div className="metric-header">
            <span className="metric-icon">🌙</span>
            <span className="metric-title">睡眠</span>
          </div>
          <div className="metric-value num">
            {formatNullable(metrics.sleepHours, 1)} <span className="metric-unit">h</span>
          </div>
          <div className="metric-trend warning">本日</div>
        </div>

        <div className="metric-card card ripple stagger-4">
          <div className="metric-header">
            <span className="metric-icon">🔥</span>
            <span className="metric-title">収支</span>
          </div>
          <div className="metric-value num">
            {calorieText} <span className="metric-unit">kcal</span>
          </div>
          <div className="metric-trend good">本日</div>
        </div>
      </div>
    </div>
  )
}
