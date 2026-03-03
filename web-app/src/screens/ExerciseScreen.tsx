import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import SegmentSelector from '../components/SegmentSelector'
import type { Segment } from '../components/SegmentSelector'
import TabAiAdvice from '../components/TabAiAdvice'
import { getExpertByTag } from '../components/ExpertCard'
import { useTabComment } from '../hooks/useTabComment'
import { fetchActivityData } from '../api/healthApi'
import type { ActivityDataResponse } from '../api/types'
import './ExerciseScreen.css'

function formatXLabel(dateStr: string, segment: Segment): string {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
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

function formatTooltipLabel(dateStr: string, segment: Segment): string {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
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

function formatRounded(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits)
}

function weekDayOfIsoDate(dateStr: string): number | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3) return null
  const [y, m, d] = parts
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return new Date(y, m - 1, d).getDay()
}

function monthTickDates(dates: string[], anchorDate: string): string[] {
  const anchorDay = weekDayOfIsoDate(anchorDate)
  if (anchorDay == null) return []
  return dates.filter((dateStr) => weekDayOfIsoDate(dateStr) === anchorDay)
}

function joinAdviceSentences(sentences: string[]): string | null {
  const normalized = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/。+$/u, ''))
  if (normalized.length === 0) return null
  return `${normalized.join('。')}。`
}

function generateActivityAdvice(
  avgSteps: number | null,
  stepsGoal: number,
  stepsGoalIsCustom: boolean,
  calorieBalance: number | null,
  avgActiveKcal: number | null,
  measuredDays: number,
  segment: Segment,
): string | null {
  const messages: string[] = []

  // 歩数 — 事実ベース
  if (avgSteps != null && Number.isFinite(avgSteps)) {
    const stepsLabel = `平均${Math.round(avgSteps).toLocaleString()}歩/日`
    if (stepsGoalIsCustom) {
      const ratio = avgSteps / stepsGoal
      if (ratio >= 1.0) {
        messages.push(`${stepsLabel}で目標を達成しています`)
      } else {
        messages.push(`${stepsLabel}（目標${stepsGoal.toLocaleString()}歩）`)
      }
    } else {
      messages.push(`${stepsLabel}の活動量です`)
    }
  }

  // カロリー — ある場合のみ補足
  if (calorieBalance != null && Number.isFinite(calorieBalance)) {
    const sign = calorieBalance > 0 ? '+' : ''
    messages.push(`カロリー収支は${sign}${Math.round(calorieBalance).toLocaleString()}kcalです`)
  } else if (avgActiveKcal != null && Number.isFinite(avgActiveKcal)) {
    messages.push(`平均活動カロリーは${Math.round(avgActiveKcal)}kcal/日です`)
  }

  // データ不足時
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

export default function ExerciseScreen() {
  const { activeDate } = useDateContext()
  const [segment, setSegment] = useState<Segment>('week')
  const [data, setData] = useState<ActivityDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { comment, loading: commentLoading } = useTabComment(activeDate, 'activity')
  const trainerConfig = getExpertByTag('trainer')

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

    const showStepsBadge = data.stepsGoalIsCustom && displaySteps != null
    const stepsRatio = displaySteps != null && stepsGoal > 0 ? displaySteps / stepsGoal : null
    let stepsStatus = '不足'
    let stepsClass = 'danger'
    if (stepsRatio != null) {
      if (stepsRatio >= 1.0) { stepsStatus = '達成'; stepsClass = 'good' }
      else if (stepsRatio >= 0.7) { stepsStatus = 'もう少し'; stepsClass = 'warning' }
    }
    const hasStepsMetric = displaySteps != null
    const hasDistanceMetric = displayDistance != null
    const hasActiveKcalMetric = displayActiveKcal != null
    const hasTotalKcalMetric = displayTotalKcal != null
    const hasIntakeKcalMetric = displayIntakeKcal != null
    const hasBmrMetric = displayBmr != null
    const hasCalorieBalance = calorieBalanceValue != null
    const hasCurrentCard = hasStepsMetric || hasDistanceMetric || hasActiveKcalMetric || hasTotalKcalMetric || hasIntakeKcalMetric || hasBmrMetric || hasCalorieBalance

    const adviceText = generateActivityAdvice(
      periodSummary.avg_steps,
      stepsGoal,
      data.stepsGoalIsCustom,
      periodSummary.calorie_balance,
      periodSummary.avg_active_kcal,
      periodSummary.measured_days,
      segment,
    )
    const monthTicks = segment === 'month' ? monthTickDates(series.map((item) => item.date), activeDate) : undefined

    const showDistanceChart = segment !== 'week'
    const showSessions = segment === 'week' && exerciseSessions.length > 0
    const showPeriodSummary = true
    const hasSummaryAvgSteps = periodSummary.avg_steps != null
    const hasSummaryDistance = periodSummary.total_distance_km != null
    const hasSummaryCalorieBalance = periodSummary.calorie_balance != null
    const hasSummaryGoalDays = segment === 'week' && periodSummary.measured_days > 0
    const hasSummaryList = hasSummaryAvgSteps || hasSummaryDistance || hasSummaryCalorieBalance || hasSummaryGoalDays

    return (
      <div className="tab-content">
        <ActivityAdviceCard advice={adviceText} />

        {hasCurrentCard ? (
          <div className="health-current-card">
            {hasStepsMetric ? (
              <div className="health-metric-row">
                <span className="health-metric-label">{useAverage ? '平均歩数' : '歩数'}</span>
                <span className="health-metric-value">
                  {showStepsBadge ? <span className={`status-badge ${stepsClass}`} style={{ marginRight: 8 }}>{stepsStatus}</span> : null}
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
            {hasActiveKcalMetric ? (
              <div className="health-metric-row">
                <span className="health-metric-label">{useAverage ? '平均活動カロリー' : '活動カロリー'}</span>
                <span className="health-metric-value">{formatRounded(displayActiveKcal)} kcal</span>
              </div>
            ) : null}
            {hasTotalKcalMetric ? (
              <div className="health-metric-row">
                <span className="health-metric-label">{useAverage ? '平均総消費' : '総消費カロリー'}</span>
                <span className="health-metric-value">{formatRounded(displayTotalKcal)} kcal</span>
              </div>
            ) : null}
            {hasIntakeKcalMetric ? (
              <div className="health-metric-row">
                <span className="health-metric-label">{useAverage ? '平均摂取' : '摂取カロリー'}</span>
                <span className="health-metric-value">{formatRounded(displayIntakeKcal)} kcal</span>
              </div>
            ) : null}
            {hasBmrMetric ? (
              <div className="health-metric-row">
                <span className="health-metric-label">基礎代謝</span>
                <span className="health-metric-value">{formatRounded(displayBmr)} kcal/日</span>
              </div>
            ) : null}
            {hasCalorieBalance ? (
              <div className="health-metric-row">
                <span className="health-metric-label">カロリー収支</span>
                <span className="health-metric-value">
                  {calorieBalanceValue > 0 ? '+' : ''}{formatRounded(calorieBalanceValue)} kcal
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Steps Chart */}
        <div className="health-chart-container">
          <div className="health-chart-title">歩数</div>
          <div className="health-chart-wrapper">
            <ResponsiveContainer
              width="100%"
              height={220}
              minWidth={1}
              minHeight={220}
              initialDimension={{ width: 300, height: 220 }}
            >
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  ticks={monthTicks}
                  interval={segment === 'month' ? 0 : undefined}
                  tickFormatter={(v) => formatXLabel(v, segment)}
                  tick={{ fontSize: 12, fill: '#5A7367' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  labelFormatter={(v) => formatTooltipLabel(v as string, segment)}
                  formatter={(val: number | undefined) => typeof val === 'number' ? val.toLocaleString() : val}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }}
                />
                {data.stepsGoalIsCustom ? <ReferenceLine y={stepsGoal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '目標', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 10 }} /> : null}
                <Bar dataKey="steps" name="歩数" fill="var(--accent-color)" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calorie Chart */}
        <div className="health-chart-container">
          <div className="health-chart-title">カロリー (消費 vs 摂取)</div>
          <div className="health-chart-wrapper">
            <ResponsiveContainer
              width="100%"
              height={220}
              minWidth={1}
              minHeight={220}
              initialDimension={{ width: 300, height: 220 }}
            >
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  ticks={monthTicks}
                  interval={segment === 'month' ? 0 : undefined}
                  tickFormatter={(v) => formatXLabel(v, segment)}
                  tick={{ fontSize: 12, fill: '#5A7367' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  labelFormatter={(v) => formatTooltipLabel(v as string, segment)}
                  formatter={(val: number | undefined) => typeof val === 'number' ? Math.round(val).toLocaleString() : val}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="total_kcal" name="消費" stroke="#F4A261" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
                <Line type="monotone" dataKey="intake_kcal" name="摂取" stroke="var(--accent-color)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distance Chart (month/year only) */}
        {showDistanceChart ? (
          <div className="health-chart-container">
            <div className="health-chart-title">距離</div>
            <div className="health-chart-wrapper">
              <ResponsiveContainer
                width="100%"
                height={220}
                minWidth={1}
                minHeight={220}
                initialDimension={{ width: 300, height: 220 }}
              >
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    ticks={monthTicks}
                    interval={segment === 'month' ? 0 : undefined}
                    tickFormatter={(v) => formatXLabel(v, segment)}
                    tick={{ fontSize: 12, fill: '#5A7367' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    labelFormatter={(v) => formatTooltipLabel(v as string, segment)}
                    formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }}
                  />
                  <Bar dataKey="distance_km" name="距離 (km)" fill="#90CAF9" radius={[4, 4, 0, 0]} barSize={segment === 'month' ? 4 : 8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* Period Summary */}
        {showPeriodSummary && hasSummaryList ? (
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
            {hasSummaryGoalDays ? (
              <div className="health-list-item">
                <span className="health-list-item-label">目標達成日数</span>
                <span className="health-list-item-value">{periodSummary.goal_days} / {periodSummary.measured_days} 日</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Exercise Sessions (week only) */}
        {showSessions ? (
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
        ) : null}
      </div>
    )
  }

  return (
    <div className="exercise-container">
      <DateNavBar />
      <SegmentSelector value={segment} onChange={(v: string) => setSegment(v as Segment)} />
      {renderContent()}
      <TabAiAdvice comment={comment} loading={commentLoading} expert={trainerConfig} />
    </div>
  )
}
