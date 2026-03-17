import { useState, useEffect } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import SegmentSelector from '../components/SegmentSelector'
import type { Segment } from '../components/SegmentSelector'
import { fetchActivityData } from '../api/healthApi'
import type { ActivityDataResponse } from '../api/types'
import { formatXLabel, formatTooltipLabel, formatRounded, monthTickDates, joinAdviceSentences } from '../utils/chart'
import './ExerciseScreen.css'

function generateActivityAdvice(
  avgSteps: number | null,
  calorieBalance: number | null,
  avgActiveKcal: number | null,
  measuredDays: number,
  segment: Segment,
): string | null {
  const messages: string[] = []
  const period = segment === 'week' ? '今週' : segment === 'month' ? 'この1か月' : 'この1年'

  if (avgSteps != null && Number.isFinite(avgSteps)) {
    const rounded = Math.round(avgSteps)
    const stepsStr = rounded.toLocaleString()
    if (rounded >= 10000) {
      messages.push(`${period}は1日平均${stepsStr}歩と活発に動けています`)
    } else if (rounded >= 7000) {
      messages.push(`${period}は1日平均${stepsStr}歩でほどよく動けています`)
    } else {
      messages.push(`${period}は1日平均${stepsStr}歩でした`)
    }
  }

  if (calorieBalance != null && Number.isFinite(calorieBalance)) {
    if (calorieBalance > 200) {
      messages.push('摂取カロリーが消費をやや上回っています')
    } else if (calorieBalance < -200) {
      messages.push('消費カロリーが摂取をやや上回っています')
    } else {
      messages.push('カロリーの摂取と消費はほぼ均衡しています')
    }
  } else if (avgActiveKcal != null && Number.isFinite(avgActiveKcal)) {
    messages.push(`活動による消費は1日あたり約${Math.round(avgActiveKcal).toLocaleString()}kcalです`)
  }

  if (messages.length === 0 && measuredDays === 0) {
    return 'この期間のアクティビティデータがまだありません。'
  }

  return joinAdviceSentences(messages)
}

function ActivityAdviceCard({ advice }: { advice: string | null }) {
  if (!advice) return null

  const sentences = advice
    .split('。')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 2)
    .map(s => s + '。')

  return (
    <div className="health-advice-card">
      <div className="health-advice-content">
        {sentences.map((s, idx) => (
          <p key={idx} className="health-advice-sentence">{s}</p>
        ))}
      </div>
    </div>
  )
}

function toExerciseName(type: number): string {
  const map: Record<number, string> = {
    56: 'ウォーキング',
    54: 'ランニング',
    8: 'サイクリング',
    79: '水泳',
    2: 'バドミントン',
  }
  return map[type] ?? 'トレーニング'
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface ActivitySummaryProps {
  useAverage: boolean
  displaySteps: number | null
  displayDistance: number | null
  showStepsBadge: boolean
}

function StepsSummarySection({ useAverage, displaySteps, displayDistance, showStepsBadge }: ActivitySummaryProps) {
  const hasStepsMetric = displaySteps != null
  const hasDistanceMetric = displayDistance != null
  if (!hasStepsMetric && !hasDistanceMetric) return null

  return (
    <div className="health-current-card">
      {hasStepsMetric ? (
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverage ? '平均歩数' : '歩数'}</span>
          <span className="health-metric-value">
            {showStepsBadge ? <span className="status-badge good" style={{ marginRight: 8 }}>達成</span> : null}
            {formatRounded(displaySteps)} 歩
          </span>
        </div>
      ) : null}
      {hasDistanceMetric ? (
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverage ? '合計距離' : '距離'}</span>
          <span className="health-metric-value">{formatRounded(displayDistance, 1)} km</span>
        </div>
      ) : null}
    </div>
  )
}

interface StepsChartProps {
  series: ActivityDataResponse['series']
  segment: Segment
  monthTicks: string[] | undefined
  stepsGoal: number
  stepsGoalIsCustom: boolean
}

function StepsChartSection({ series, segment, monthTicks, stepsGoal, stepsGoalIsCustom }: StepsChartProps) {
  return (
    <div className="health-chart-container">
      <div className="health-chart-title">歩数</div>
      <div className="health-chart-wrapper">
        <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={220} initialDimension={{ width: 300, height: 220 }}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toLocaleString() : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }} />
            {stepsGoalIsCustom ? <ReferenceLine y={stepsGoal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '目標', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 10 }} /> : null}
            <Bar dataKey="steps" name="歩数" fill="var(--accent-color)" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface DistanceChartProps {
  series: ActivityDataResponse['series']
  segment: Segment
  monthTicks: string[] | undefined
}

function DistanceChartSection({ series, segment, monthTicks }: DistanceChartProps) {
  if (segment === 'week') return null

  return (
    <div className="health-chart-container">
      <div className="health-chart-title">距離</div>
      <div className="health-chart-wrapper">
        <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={220} initialDimension={{ width: 300, height: 220 }}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }} />
            <Bar dataKey="distance_km" name="距離 (km)" fill="#90CAF9" radius={[4, 4, 0, 0]} barSize={segment === 'month' ? 4 : 8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface CalorieSummaryProps {
  useAverage: boolean
  displayActiveKcal: number | null
  displayTotalKcal: number | null
  displayIntakeKcal: number | null
  displayBmr: number | null
  calorieBalanceValue: number | null
}

function CalorieSummarySection({ useAverage, displayActiveKcal, displayTotalKcal, displayIntakeKcal, displayBmr, calorieBalanceValue }: CalorieSummaryProps) {
  const hasAny = displayActiveKcal != null || displayTotalKcal != null || displayIntakeKcal != null || displayBmr != null || calorieBalanceValue != null
  if (!hasAny) return null

  return (
    <div className="health-current-card">
      {displayActiveKcal != null ? (
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverage ? '平均活動カロリー' : '活動カロリー'}</span>
          <span className="health-metric-value">{formatRounded(displayActiveKcal)} kcal</span>
        </div>
      ) : null}
      {displayTotalKcal != null ? (
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverage ? '平均総消費' : '総消費カロリー'}</span>
          <span className="health-metric-value">{formatRounded(displayTotalKcal)} kcal</span>
        </div>
      ) : null}
      {displayIntakeKcal != null ? (
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverage ? '平均摂取' : '摂取カロリー'}</span>
          <span className="health-metric-value">{formatRounded(displayIntakeKcal)} kcal</span>
        </div>
      ) : null}
      {displayBmr != null ? (
        <div className="health-metric-row">
          <span className="health-metric-label">基礎代謝</span>
          <span className="health-metric-value">{formatRounded(displayBmr)} kcal/日</span>
        </div>
      ) : null}
      {calorieBalanceValue != null ? (
        <div className="health-metric-row">
          <span className="health-metric-label">カロリー収支</span>
          <span className="health-metric-value">
            {calorieBalanceValue > 0 ? '+' : ''}{formatRounded(calorieBalanceValue)} kcal
          </span>
        </div>
      ) : null}
    </div>
  )
}

interface CalorieChartProps {
  series: ActivityDataResponse['series']
  segment: Segment
  monthTicks: string[] | undefined
  hasIntakeData: boolean
  balanceData: Array<ActivityDataResponse['series'][number] & { balance: number | null }>
}

function CalorieChartSection({ series, segment, monthTicks, hasIntakeData, balanceData }: CalorieChartProps) {
  return (
    <div className="health-chart-container">
      <div className="health-chart-title">{hasIntakeData ? 'カロリー収支' : '消費カロリー'}</div>
      <div className="health-chart-wrapper">
        <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={220} initialDimension={{ width: 300, height: 220 }}>
          <BarChart data={hasIntakeData ? balanceData : series}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              labelFormatter={(v) => formatTooltipLabel(v as string, segment)}
              formatter={(val: number | undefined) => {
                if (typeof val !== 'number') return val
                if (hasIntakeData) {
                  const sign = val > 0 ? '+' : ''
                  return `${sign}${Math.round(val).toLocaleString()} kcal`
                }
                return `${Math.round(val).toLocaleString()} kcal`
              }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }}
            />
            {hasIntakeData ? (
              <>
                <ReferenceLine y={0} stroke="#999" />
                <Bar dataKey="balance" name="収支" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8}>
                  {balanceData.map((entry, index) => {
                    const balance = typeof entry.balance === 'number' ? entry.balance : null
                    const fill = balance != null && balance >= 0 ? '#81C784' : '#E0E0E0'
                    return <Cell key={`${entry.date}-${index}`} fill={fill} />
                  })}
                </Bar>
              </>
            ) : (
              <Bar dataKey="total_kcal" name="消費カロリー" fill="#F4A261" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface PeriodSummaryProps {
  periodSummary: ActivityDataResponse['periodSummary']
}

function PeriodSummarySection({ periodSummary }: PeriodSummaryProps) {
  const hasSummaryAvgSteps = periodSummary.avg_steps != null
  const hasSummaryDistance = periodSummary.total_distance_km != null
  const hasSummaryCalorieBalance = periodSummary.calorie_balance != null
  if (!hasSummaryAvgSteps && !hasSummaryDistance && !hasSummaryCalorieBalance) return null

  return (
    <div className="health-list-container">
      {hasSummaryAvgSteps ? (
        <div className="health-list-item">
          <span className="health-list-item-label">平均歩数</span>
          <span className="health-list-item-value">{formatRounded(periodSummary.avg_steps)} 歩/日</span>
        </div>
      ) : null}
      {hasSummaryDistance ? (
        <div className="health-list-item">
          <span className="health-list-item-label">合計距離</span>
          <span className="health-list-item-value">{formatRounded(periodSummary.total_distance_km, 1)} km</span>
        </div>
      ) : null}
      {hasSummaryCalorieBalance ? (
        <div className="health-list-item">
          <span className="health-list-item-label">累積カロリー収支</span>
          <span className="health-list-item-value">
            {periodSummary.calorie_balance != null && periodSummary.calorie_balance > 0 ? '+' : ''}
            {formatRounded(periodSummary.calorie_balance)} kcal
          </span>
        </div>
      ) : null}
    </div>
  )
}

interface ExerciseSessionProps {
  exerciseSessions: ActivityDataResponse['exerciseSessions']
  segment: Segment
}

function ExerciseSessionSection({ exerciseSessions, segment }: ExerciseSessionProps) {
  if (segment !== 'week' || exerciseSessions.length === 0) return null

  return (
    <div className="health-current-card exercise-sessions-card">
      <div className="exercise-sessions-title">エクササイズ履歴</div>
      <ul className="exercise-session-list">
        {exerciseSessions.map((session, index) => (
          <li key={`${session.date}-${session.exerciseType}-${index}`} className="exercise-session-row">
            <div className="exercise-session-main">
              <span className="exercise-session-name">
                {session.title || toExerciseName(session.exerciseType)}
              </span>
              <span className="exercise-session-time">{formatTime(session.startTime)}</span>
            </div>
            <div className="exercise-session-sub">
              <span className="exercise-session-date">{session.date.slice(5)}</span>
              <span>{session.durationMinutes != null ? `${Math.round(session.durationMinutes)}分` : '--'}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityContent({ data, segment, activeDate }: { data: ActivityDataResponse, segment: Segment, activeDate: string }) {
  const { current, series, periodSummary, exerciseSessions, stepsGoal } = data
  const useAverage = segment !== 'week'
  const displaySteps = useAverage ? (periodSummary.avg_steps ?? current.steps) : current.steps
  const displayDistance = useAverage ? (periodSummary.total_distance_km ?? current.distance_km) : current.distance_km
  const displayActiveKcal = useAverage ? (periodSummary.avg_active_kcal ?? current.active_kcal) : current.active_kcal
  const displayTotalKcal = useAverage ? (periodSummary.avg_total_kcal ?? current.total_kcal) : current.total_kcal
  const displayIntakeKcal = useAverage ? (periodSummary.avg_intake_kcal ?? current.intake_kcal) : current.intake_kcal
  const displayBmr = current.bmr_kcal
  const calorieBalanceValue = displayIntakeKcal != null && displayTotalKcal != null
    ? displayIntakeKcal - displayTotalKcal
    : null

  const showStepsBadge = data.stepsGoalIsCustom && displaySteps != null && stepsGoal > 0 && displaySteps >= stepsGoal
  const adviceText = generateActivityAdvice(
    periodSummary.avg_steps,
    periodSummary.calorie_balance,
    periodSummary.avg_active_kcal,
    periodSummary.measured_days,
    segment,
  )
  const monthTicks = segment === 'month' ? monthTickDates(series.map((item) => item.date), activeDate) : undefined
  const hasIntakeData = series.some((item) => item.intake_kcal != null && item.intake_kcal > 0)
  const balanceData = hasIntakeData
    ? series.map((item) => ({
      ...item,
      balance: item.intake_kcal != null && item.total_kcal != null
        ? Math.round(item.intake_kcal - item.total_kcal)
        : null,
    }))
    : []

  return (
    <div className="tab-content">
      <ActivityAdviceCard advice={adviceText} />
      <StepsSummarySection useAverage={useAverage} displaySteps={displaySteps} displayDistance={displayDistance} showStepsBadge={showStepsBadge} />
      <StepsChartSection series={series} segment={segment} monthTicks={monthTicks} stepsGoal={stepsGoal} stepsGoalIsCustom={data.stepsGoalIsCustom} />
      <DistanceChartSection series={series} segment={segment} monthTicks={monthTicks} />
      <CalorieSummarySection useAverage={useAverage} displayActiveKcal={displayActiveKcal} displayTotalKcal={displayTotalKcal} displayIntakeKcal={displayIntakeKcal} displayBmr={displayBmr} calorieBalanceValue={calorieBalanceValue} />
      <CalorieChartSection series={series} segment={segment} monthTicks={monthTicks} hasIntakeData={hasIntakeData} balanceData={balanceData} />
      <PeriodSummarySection periodSummary={periodSummary} />
      <ExerciseSessionSection exerciseSessions={exerciseSessions} segment={segment} />
    </div>
  )
}

export default function ExerciseScreen() {
  const { activeDate } = useDateContext()
  const [segment, setSegment] = useState<Segment>('week')
  const [data, setData] = useState<ActivityDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchActivityData(activeDate, segment)
      .then((res) => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setError('アクティビティデータの取得に失敗しました。'); setLoading(false) } })
    return () => { mounted = false }
  }, [activeDate, segment])

  const renderContent = () => {
    if (loading) return <div className="health-empty-state"><span className="health-empty-text">読み込み中...</span></div>
    if (error) return <div className="health-empty-state health-error-state"><span className="health-empty-text" style={{ color: 'var(--danger-color)' }}>{error}</span></div>
    if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">データがありません</span></div>
    return <ActivityContent data={data} segment={segment} activeDate={activeDate} />
  }

  return (
    <div className="exercise-container">
      <DateNavBar />
      <SegmentSelector value={segment} onChange={(v: string) => setSegment(v as Segment)} />
      {renderContent()}
    </div>
  )
}
