import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchSummary } from '../api/healthApi'
import type { ExerciseSessionItem, RequestState, SummaryResponse } from '../api/types'
import advisorTrainer from '../assets/advisor_trainer.png'
import './ExerciseScreen.css'

type PeriodType = 'today' | 'weekly' | 'monthly'

interface ExercisePoint {
  date: string
  label: string
  steps: number | null
  activeKcal: number | null
  totalKcal: number | null
  intakeKcal: number | null
  distanceKm: number | null
  speedKmh: number | null
}

function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function toDateLabel(isoDate: string, period: PeriodType): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (period === 'weekly') {
    return date.toLocaleDateString('ja-JP', { weekday: 'short' })
  }
  return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

function formatNullable(value: number | null, digits = 0): string {
  if (value == null) {
    return '--'
  }
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
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

function buildPoints(summary: SummaryResponse, period: Extract<PeriodType, 'weekly' | 'monthly'>): ExercisePoint[] {
  const days = period === 'weekly' ? 7 : 30
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stepsMap = toMap(summary.stepsByDate, (item) => item.steps)
  const activeSeries = summary.activeCalByDate ?? summary.activeCaloriesByDate
  const totalSeries = summary.totalCalByDate ?? summary.totalCaloriesByDate
  const intakeSeries = summary.intakeCaloriesByDate
  const distanceSeries =
    summary.distanceByDate?.map((item) => ({ date: item.date, km: item.meters / 1000 })) ??
    summary.distanceKmByDate

  const activeMap = toMap(activeSeries, (item) => item.kcal)
  const totalMap = toMap(totalSeries, (item) => item.kcal)
  const intakeMap = toMap(intakeSeries, (item) => item.kcal)
  const distanceMap = toMap(distanceSeries, (item) => item.km)
  const speedMap = toMap(summary.speedKmhByDate, (item) => item.kmh)

  const points: ExercisePoint[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const isoDate = date.toLocaleDateString('sv-SE')
    points.push({
      date: isoDate,
      label: toDateLabel(isoDate, period),
      steps: stepsMap.get(isoDate) ?? null,
      activeKcal: activeMap.get(isoDate) ?? null,
      totalKcal: totalMap.get(isoDate) ?? null,
      intakeKcal: intakeMap.get(isoDate) ?? null,
      distanceKm: distanceMap.get(isoDate) ?? null,
      speedKmh: speedMap.get(isoDate) ?? null,
    })
  }
  return points
}

function averageRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value != null)
  if (recorded.length === 0) {
    return null
  }
  return recorded.reduce((sum, value) => sum + value, 0) / recorded.length
}

function sumRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value != null)
  if (recorded.length === 0) {
    return null
  }
  return recorded.reduce((sum, value) => sum + value, 0)
}

function estimateSpeedKmh(distanceKm: number | null, steps: number | null): number | null {
  if (distanceKm == null || steps == null || steps <= 0) {
    return null
  }
  const stepLengthMeters = (distanceKm * 1000) / steps
  const estimatedCadencePerMinute = 100
  return (stepLengthMeters * estimatedCadencePerMinute * 60) / 1000
}

function latestByDate<T extends { date: string }>(series: T[]): T | null {
  if (series.length === 0) {
    return null
  }
  return [...series].sort((a, b) => a.date.localeCompare(b.date))[series.length - 1] ?? null
}

function todayOrLatestByDate<T extends { date: string }>(series: T[]): T | null {
  const today = todayLocal()
  const todayPoint = series.find((item) => item.date === today)
  if (todayPoint) {
    return todayPoint
  }
  return latestByDate(series)
}

function normalizeSessions(summary: SummaryResponse): ExerciseSessionItem[] {
  return (summary.exerciseSessions ?? []).filter((item) => item.date != null)
}

function toExerciseName(type: number): string {
  const map: Record<number, string> = {
    56: 'ウォーキング',
    54: 'ランニング',
    8: 'サイクリング',
  }
  return map[type] ?? 'トレーニング'
}

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '--:--'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--:--'
  }
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function ExerciseScreen() {
  const [period, setPeriod] = useState<PeriodType>('today')
  const [state, setState] = useState<RequestState<SummaryResponse>>({ status: 'loading' })
  const [activeStepsIndex, setActiveStepsIndex] = useState<number | null>(null)
  const [activeCaloriesIndex, setActiveCaloriesIndex] = useState<number | null>(null)
  const [activeDistanceIndex, setActiveDistanceIndex] = useState<number | null>(null)

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

  useEffect(() => {
    setActiveStepsIndex(null)
    setActiveCaloriesIndex(null)
    setActiveDistanceIndex(null)
  }, [period])

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

  const summary = state.data
  const activitySeries = summary.activeCalByDate ?? summary.activeCaloriesByDate
  const totalSeries = summary.totalCalByDate ?? summary.totalCaloriesByDate
  const distanceSeries =
    summary.distanceByDate?.map((item) => ({ date: item.date, km: item.meters / 1000 })) ??
    summary.distanceKmByDate
  const speedSeries = summary.speedKmhByDate

  const todaySteps = todayOrLatestByDate(summary.stepsByDate)?.steps ?? null
  const todayDistance = todayOrLatestByDate(distanceSeries)?.km ?? null
  const todayActive = todayOrLatestByDate(activitySeries)?.kcal ?? null
  const todayTotal = todayOrLatestByDate(totalSeries)?.kcal ?? null
  const todaySpeedRecorded = todayOrLatestByDate(speedSeries)?.kmh ?? null
  const todaySpeed = todaySpeedRecorded ?? estimateSpeedKmh(todayDistance, todaySteps)

  const today = todayLocal()
  const todaySessions = normalizeSessions(summary)
    .filter((item) => item.date === today)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const rangePoints = period === 'today' ? [] : buildPoints(summary, period)

  const avgSteps = averageRecorded(rangePoints.map((point) => point.steps))
  const sumDistance = sumRecorded(rangePoints.map((point) => point.distanceKm))

  const selectedSteps = activeStepsIndex != null ? rangePoints[activeStepsIndex] : null
  const selectedCalories = activeCaloriesIndex != null ? rangePoints[activeCaloriesIndex] : null
  const selectedDistance = activeDistanceIndex != null ? rangePoints[activeDistanceIndex] : null
  const balanceSum = (() => {
    const recorded = rangePoints.filter((point) => point.intakeKcal != null && point.totalKcal != null)
    if (recorded.length === 0) {
      return null
    }
    return recorded.reduce((sum, point) => sum + (point.intakeKcal as number) - (point.totalKcal as number), 0)
  })()
  const trainerComment =
    summary.insights[0]?.message ??
    '活動データを元に、運動量と回復のバランスを毎日調整しましょう。'

  return (
    <div className="exercise-container fade-in">
      <div className="exercise-segment-control">
        <button
          type="button"
          className={`exercise-segment-btn ${period === 'today' ? 'active' : ''}`}
          onClick={() => setPeriod('today')}
        >
          今日
        </button>
        <button
          type="button"
          className={`exercise-segment-btn ${period === 'weekly' ? 'active' : ''}`}
          onClick={() => setPeriod('weekly')}
        >
          週間
        </button>
        <button
          type="button"
          className={`exercise-segment-btn ${period === 'monthly' ? 'active' : ''}`}
          onClick={() => setPeriod('monthly')}
        >
          月間
        </button>
      </div>

      {period === 'today' && (
        <>
          <section className="exercise-insight-section">
            <div className="exercise-insight-avatar">
              <img src={advisorTrainer} alt="Trainer" />
            </div>
            <div className="exercise-insight-bubble">
              <div className="exercise-insight-title">フィジカルトレーナー</div>
              <p className="exercise-insight-text">{trainerComment}</p>
            </div>
          </section>

          <section className="card">
            <h3 className="exercise-title">アクティビティサマリー</h3>
            <div className="exercise-summary-grid">
              <div className="exercise-summary-item">
                <span>歩数</span>
                <strong>{formatNullable(todaySteps, 0)} 歩</strong>
              </div>
              <div className="exercise-summary-item">
                <span>距離</span>
                <strong>{formatNullable(todayDistance, 1)} km</strong>
              </div>
              <div className="exercise-summary-item">
                <span>活動カロリー</span>
                <strong>{formatNullable(todayActive, 0)} kcal</strong>
              </div>
              <div className="exercise-summary-item">
                <span>総消費カロリー</span>
                <strong>{formatNullable(todayTotal, 0)} kcal</strong>
              </div>
              <div className="exercise-summary-item">
                <span>平均速度</span>
                <strong>{formatNullable(todaySpeed, 1)} km/h</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <h3 className="exercise-title">エクササイズ履歴</h3>
            {todaySessions.length === 0 ? (
              <p className="exercise-empty">記録されたエクササイズはありません</p>
            ) : (
              <ul className="exercise-session-list">
                {todaySessions.map((session, index) => (
                  <li key={`${session.date}-${session.exerciseType}-${index}`} className="exercise-session-row">
                    <div className="exercise-session-main">
                      <span className="exercise-session-name">
                        {session.title || toExerciseName(session.exerciseType)}
                      </span>
                      <span className="exercise-session-time">{formatTime(session.startTime)}</span>
                    </div>
                    <div className="exercise-session-sub">
                      {session.durationMinutes == null ? '--' : Math.round(session.durationMinutes)}分
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {period !== 'today' && (
        <>
          <section className="exercise-summary-range">
            <h3 className="exercise-title">サマリー</h3>
            <div className="exercise-range-grid">
              <div className="card exercise-range-card">
                <div className="exercise-range-label">平均歩数</div>
                <div className="exercise-range-value">{formatNullable(avgSteps, 0)} 歩/日</div>
              </div>
              <div className="card exercise-range-card">
                <div className="exercise-range-label">合計距離</div>
                <div className="exercise-range-value">{formatNullable(sumDistance, 1)} km</div>
              </div>
              <div className="card exercise-range-card">
                <div className="exercise-range-label">収支（摂取-消費）</div>
                <div className="exercise-range-value">
                  {balanceSum == null ? '--' : `${balanceSum > 0 ? '+' : ''}${Math.round(balanceSum).toLocaleString('ja-JP')} kcal`}
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h3 className="exercise-title">歩数グラフ</h3>
            {selectedSteps ? (
              <p className="exercise-selected-value">
                {selectedSteps.label}: {formatNullable(selectedSteps.steps, 0)} 歩
              </p>
            ) : (
              <p className="exercise-selected-value">棒をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangePoints}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Bar
                    dataKey="steps"
                    radius={[6, 6, 0, 0]}
                    onClick={(_, index) => setActiveStepsIndex(index)}
                    activeBar={{ fill: 'transparent', stroke: 'none' }}
                  >
                    {rangePoints.map((_, index) => (
                      <Cell
                        key={`steps-${index}`}
                        fill={index === activeStepsIndex ? 'var(--accent-color)' : 'rgba(136, 212, 180, 0.45)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3 className="exercise-title">消費カロリーグラフ</h3>
            {selectedCalories ? (
              <p className="exercise-selected-value">
                {selectedCalories.label}: 消費 {formatNullable(selectedCalories.totalKcal, 0)} kcal / 摂取 {formatNullable(selectedCalories.intakeKcal, 0)} kcal
              </p>
            ) : (
              <p className="exercise-selected-value">線をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rangePoints}
                  onClick={(event) => {
                    if (event && typeof event.activeTooltipIndex === 'number') {
                      setActiveCaloriesIndex(event.activeTooltipIndex)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Line
                    type="monotone"
                    dataKey="totalKcal"
                    stroke="var(--warning-color)"
                    strokeWidth={3}
                    dot={(props: {
                      cx?: number
                      cy?: number
                      index?: number
                    }) => {
                      if (props.cx == null || props.cy == null || props.index == null) {
                        return null
                      }
                      const selected = props.index === activeCaloriesIndex
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={selected ? 5 : 3.5}
                          fill={selected ? 'var(--accent-color)' : 'var(--warning-color)'}
                        />
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="intakeKcal"
                    stroke="var(--accent-color)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3 className="exercise-title">距離グラフ</h3>
            {selectedDistance ? (
              <p className="exercise-selected-value">
                {selectedDistance.label}: {formatNullable(selectedDistance.distanceKm, 2)} km
              </p>
            ) : (
              <p className="exercise-selected-value">棒をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangePoints}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Bar
                    dataKey="distanceKm"
                    radius={[6, 6, 0, 0]}
                    onClick={(_, index) => setActiveDistanceIndex(index)}
                    activeBar={{ fill: 'transparent', stroke: 'none' }}
                  >
                    {rangePoints.map((_, index) => (
                      <Cell
                        key={`distance-${index}`}
                        fill={index === activeDistanceIndex ? 'var(--accent-color)' : 'rgba(136, 212, 180, 0.45)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
