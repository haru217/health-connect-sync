import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchSummary } from '../api/healthApi'
import type { RequestState, SummaryResponse } from '../api/types'
import './ExerciseScreen.css'

type PeriodType = 'weekly' | 'monthly'

interface ExercisePoint {
  date: string
  label: string
  steps: number
  activeKcal: number
  distanceKm: number
}

function toMap<T extends { date: string }>(series: T[], valueSelector: (item: T) => number): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of series) {
    const value = valueSelector(item)
    if (Number.isFinite(value)) {
      map.set(item.date, value)
    }
  }
  return map
}

function toDateLabel(isoDate: string, period: PeriodType): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (period === 'weekly') {
    return date.toLocaleDateString('ja-JP', { weekday: 'short' })
  }
  return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

function buildPeriodPoints(summary: SummaryResponse, period: PeriodType): ExercisePoint[] {
  const days = period === 'weekly' ? 7 : 30
  const stepsMap = toMap(summary.stepsByDate, (item) => item.steps)
  const activeCaloriesMap = toMap(summary.activeCaloriesByDate, (item) => item.kcal)
  const distanceMap = toMap(summary.distanceKmByDate, (item) => item.km)

  const points: ExercisePoint[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() - i)
    const isoDate = date.toLocaleDateString('sv-SE')
    points.push({
      date: isoDate,
      label: toDateLabel(isoDate, period),
      steps: stepsMap.get(isoDate) ?? 0,
      activeKcal: activeCaloriesMap.get(isoDate) ?? 0,
      distanceKm: distanceMap.get(isoDate) ?? 0,
    })
  }

  return points
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export default function ExerciseScreen() {
  const [period, setPeriod] = useState<PeriodType>('weekly')
  const [state, setState] = useState<RequestState<SummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const summary = await fetchSummary()
        if (!alive) {
          return
        }
        setState({ status: 'success', data: summary })
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
      <div className="exercise-container fade-in">
        <div className="card">読み込み中...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="exercise-container fade-in">
        <div className="card">読み込みエラー: {state.error}</div>
      </div>
    )
  }

  const points = buildPeriodPoints(state.data, period)
  const avgSteps = average(points.map((point) => point.steps))
  const totalDistance = points.reduce((sum, point) => sum + point.distanceKm, 0)
  const totalCalories = points.reduce((sum, point) => sum + point.activeKcal, 0)

  return (
    <>
      <div className="exercise-container fade-in">
        <div className="segment-control">
          <div className={`segment-btn ripple ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>
            週間
          </div>
          <div
            className={`segment-btn ripple ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            月間
          </div>
        </div>

        <div className="summary-section">
          <h3 className="section-title">サマリー</h3>
          <div className="summary-grid">
            <div className="summary-card card ripple stagger-1">
              <div className="summary-label">平均歩数</div>
              <div className="summary-value num">
                {Math.round(avgSteps).toLocaleString('ja-JP')} <span className="unit">歩/日</span>
              </div>
            </div>
            <div className="summary-card card ripple stagger-2">
              <div className="summary-label">合計距離</div>
              <div className="summary-value num">
                {totalDistance.toFixed(1)} <span className="unit">km</span>
              </div>
            </div>
            <div className="summary-card card ripple stagger-3">
              <div className="summary-label">消費カロリー</div>
              <div className="summary-value num">
                {Math.round(totalCalories).toLocaleString('ja-JP')} <span className="unit">kcal</span>
              </div>
            </div>
          </div>
        </div>

        <div className="chart-section">
          <h3 className="section-title">アクティビティ推移</h3>

          <div className="chart-card card stagger-4">
            <div className="chart-header">歩数（{period === 'weekly' ? '過去7日間' : '過去30日間'}）</div>
            <div className="rechart-container" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="steps" fill="var(--accent-color)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card card stagger-5">
            <div className="chart-header">消費カロリー</div>
            <div className="rechart-container" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Line
                    type="monotone"
                    dataKey="activeKcal"
                    stroke="var(--warning-color)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: 'var(--warning-color)', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <button className="fab ripple" aria-label="運動を追加">
        ＋
      </button>
    </>
  )
}
