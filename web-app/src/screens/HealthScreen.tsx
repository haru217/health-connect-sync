import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import SegmentSelector from '../components/SegmentSelector'
import type { Segment } from '../components/SegmentSelector'
import {
  fetchBodyData, fetchSleepData, fetchVitalsData
} from '../api/healthApi'
import type {
  BodyDataResponse, SleepDataResponse, VitalsDataResponse
} from '../api/types'
import './HealthScreen.css'

type InnerTab = 'composition' | 'circulation' | 'sleep' | 'vital'

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
    // dateStr は 'YYYY-MM' 形式
    const parts = dateStr.split('-')
    if (parts.length >= 2) return `${parseInt(parts[1], 10)}月`
    return dateStr
  }
  // month: 日付表示
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
  if (value == null || !Number.isFinite(value)) {
    return '-'
  }
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

function normalizePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value <= 1 ? value * 100 : value
}

function joinAdviceSentences(sentences: string[]): string | null {
  const normalized = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .map((sentence) => sentence.replace(/。+$/u, ''))

  if (normalized.length === 0) return null
  return `${normalized.join('。')}。`
}

function formatAdviceKg(value: number): string {
  return Math.abs(value).toFixed(1)
}

function generateCompositionAdvice(
  bmi: number | null,
  diffWeightKg: number | null,
  goalDiffKg: number | null,
  segment: Segment
): string | null {
  if (bmi == null || !Number.isFinite(bmi)) return null

  const messages: string[] = []
  if (bmi < 18.5) {
    messages.push('BMIが低めです。バランスの良い食事を心がけましょう。')
  } else if (bmi < 25) {
    messages.push('BMIは標準範囲内です。この調子を維持しましょう。')
  } else if (bmi < 30) {
    messages.push('BMIがやや高めです。食事と運動のバランスを見直してみましょう。')
  } else {
    messages.push('BMIが高めです。かかりつけ医への相談もご検討ください。')
  }

  if (segment === 'week' && diffWeightKg != null && Number.isFinite(diffWeightKg)) {
    if (diffWeightKg < -0.5) {
      messages.push(`今週は${formatAdviceKg(diffWeightKg)}kg減少しました。順調です。`)
    } else if (diffWeightKg > 1.0) {
      messages.push(`今週は${formatAdviceKg(diffWeightKg)}kg増加しています。食事内容を振り返ってみましょう。`)
    }
  }

  if (goalDiffKg != null && Number.isFinite(goalDiffKg) && goalDiffKg <= 2 && goalDiffKg > 0) {
    messages.push(`目標体重まであと${formatAdviceKg(goalDiffKg)}kgです。もう少しです！`)
  }

  const text = joinAdviceSentences(messages)
  return text || null
}

function generateCirculationAdvice(
  systolic: number | null,
  diastolic: number | null,
  restingHr: number | null,
  highBpDays: number,
  segment: Segment
): string | null {
  const hasBp = systolic != null && Number.isFinite(systolic) && diastolic != null && Number.isFinite(diastolic)
  const hasRestingHr = restingHr != null && Number.isFinite(restingHr)
  if (!hasBp && !hasRestingHr) return null

  const messages: string[] = []
  if (hasBp) {
    if (systolic >= 145 || diastolic >= 90) {
      messages.push('血圧が高い状態です。かかりつけ医への相談をおすすめします。')
    } else if (systolic >= 135 || diastolic >= 85) {
      messages.push('血圧が高い状態が続いています。生活習慣の改善を検討しましょう。')
    } else if (systolic >= 125 || diastolic >= 75) {
      messages.push('血圧がやや高めです。塩分の摂りすぎに注意しましょう。')
    } else {
      messages.push('血圧は正常範囲です。引き続き健康的な生活を。')
    }
  }

  if (hasRestingHr) {
    if (restingHr < 60) {
      messages.push('安静時心拍が低めです。体調に変化がないか確認しましょう。')
    } else if (restingHr >= 80) {
      messages.push('安静時心拍がやや高めです。リラックスする時間を作りましょう。')
    }
  }

  if (segment !== 'week' && highBpDays >= 3) {
    messages.push(`期間中に高血圧判定が${highBpDays}日ありました。経過を注視しましょう。`)
  }

  const text = joinAdviceSentences(messages)
  return text || null
}

function generateSleepAdvice(
  sleepMinutes: number | null,
  deepSleepRatio: number | null,
  avgSpo2: number | null
): string | null {
  const messages: string[] = []
  if (sleepMinutes != null && Number.isFinite(sleepMinutes)) {
    if (sleepMinutes >= 420) {
      messages.push('十分な睡眠が取れています。この調子を維持しましょう。')
    } else if (sleepMinutes >= 360) {
      messages.push('睡眠がやや短めです。もう少し早めの就寝を心がけてみましょう。')
    } else {
      messages.push('睡眠時間が不足しています。睡眠の質と量の改善を意識しましょう。')
    }
  }

  const deepRatioPercent = normalizePercent(deepSleepRatio)
  if (deepRatioPercent != null && deepRatioPercent < 15) {
    messages.push('深い睡眠の割合が少なめです。就寝前のスマホ利用を控えると改善されることがあります。')
  }

  if (avgSpo2 != null && Number.isFinite(avgSpo2) && avgSpo2 < 95) {
    messages.push('血中酸素濃度が低めです。気になる場合は医師に相談してください。')
  }

  const text = joinAdviceSentences(messages)
  return text || null
}

function HealthAdviceCard({ advice }: { advice: string | null }) {
  if (!advice) return null

  // 「。」で分割して複数行に（最大2文まで）
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

// InnerTabBar Component
function InnerTabBar({ tab, onTabChange }: { tab: InnerTab, onTabChange: (t: InnerTab) => void }) {
  return (
    <div className="inner-tab-bar">
      <button type="button" className={`inner-tab ${tab === 'composition' ? 'active' : ''}`} onClick={() => onTabChange('composition')}>体重</button>
      <button type="button" className={`inner-tab ${tab === 'circulation' ? 'active' : ''}`} onClick={() => onTabChange('circulation')}>血圧・心拍</button>
      <button type="button" className={`inner-tab ${tab === 'sleep' ? 'active' : ''}`} onClick={() => onTabChange('sleep')}>睡眠</button>
    </div>
  )
}

// CompositionTab Component
function CompositionTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<BodyDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchBodyData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">読み込み中...</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">データがありません</span></div>

  const current = data.current
  const useAverageCard = segment !== 'week'
  const displayWeight = useAverageCard ? (data.periodSummary.avg_weight_kg ?? current.weight_kg) : current.weight_kg
  const displayBodyFat = useAverageCard ? (data.periodSummary.avg_body_fat_pct ?? current.body_fat_pct) : current.body_fat_pct
  const displayBmi = useAverageCard ? (data.periodSummary.avg_bmi ?? current.bmi) : current.bmi
  const avgBmr = data.series
    .map((item) => item.bmr_kcal)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const displayBmr = useAverageCard
    ? (avgBmr.length > 0 ? avgBmr.reduce((sum, value) => sum + value, 0) / avgBmr.length : current.bmr_kcal)
    : current.bmr_kcal
  const hasWeightMetric = displayWeight != null
  const hasBodyFatMetric = displayBodyFat != null
  const hasBmiMetric = displayBmi != null
  const goalWeight = data.goalWeight
  const hasGoalWeightMetric = goalWeight != null
  const hasBmrMetric = displayBmr != null
  const hasCurrentCard = hasWeightMetric || hasBodyFatMetric || hasBmiMetric || hasGoalWeightMetric || hasBmrMetric
  const monthTicks = segment === 'month' ? monthTickDates(data.series.map((item) => item.date), date) : undefined

  // 週次変化の計算 (for week segment)
  const isWeek = segment === 'week'
  let diffWeight = 0
  let diffFat = 0
  if (isWeek && data.series.length > 0) {
    const first = data.series[0]
    const last = data.series[data.series.length - 1]
    if (last.weight_kg != null && first.weight_kg != null) diffWeight = last.weight_kg - first.weight_kg
    if (last.body_fat_pct != null && first.body_fat_pct != null) diffFat = last.body_fat_pct - first.body_fat_pct
  }
  const goalDiffKg = hasGoalWeightMetric && hasWeightMetric ? Math.abs(displayWeight - goalWeight) : null
  const adviceResult = generateCompositionAdvice(displayBmi, diffWeight, goalDiffKg, segment)

  return (
    <div className="tab-content">
      <HealthAdviceCard advice={adviceResult} />
      {hasCurrentCard ? (
        <div className="health-current-card">
          {hasWeightMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均体重' : '体重'}</span>
              <span className="health-metric-value">{displayWeight.toFixed(1)} kg</span>
            </div>
          ) : null}
          {hasBodyFatMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均体脂肪' : '体脂肪'}</span>
              <span className="health-metric-value">{displayBodyFat.toFixed(1)} %</span>
            </div>
          ) : null}
          {hasBmiMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均BMI' : 'BMI'}</span>
              <span className="health-metric-value">
                <span className={`status-badge ${displayBmi < 25 ? 'good' : 'warning'}`} style={{ marginRight: 8 }}>{displayBmi < 25 ? '標準' : '軽度肥満'}</span>
                {displayBmi.toFixed(1)}
              </span>
            </div>
          ) : null}
          {hasGoalWeightMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">目標体重</span>
              <span className="health-metric-value">{goalWeight.toFixed(1)} kg</span>
            </div>
          ) : null}
          {hasBmrMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均基礎代謝' : '基礎代謝'}</span>
              <span className="health-metric-value">{Math.round(displayBmr)} kcal/日</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="health-chart-container">
        <div className="health-chart-title">体重と体脂肪の推移</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={1}
            minHeight={220}
            initialDimension={{ width: 300, height: 220 }}
          >
            {segment === 'year' ? (
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                {data.goalWeight != null && <ReferenceLine y={data.goalWeight} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '目標', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 12 }} />}
                <Line type="monotone" dataKey="weight_kg" name="体重 (kg)" stroke="var(--accent-color)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
              </LineChart>
            ) : (
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} hide />
                <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                {data.goalWeight != null && <ReferenceLine yAxisId="left" y={data.goalWeight} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '目標', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 12 }} />}
                <Line yAxisId="right" type="monotone" dataKey="body_fat_pct" name="体脂肪 (%)" stroke="#FFCC80" strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
                <Line yAxisId="left" type="monotone" dataKey="weight_kg" name="体重 (kg)" stroke="var(--accent-color)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {isWeek && (
        <div className="health-list-container">
          <div className="health-list-item">
            <span className="health-list-item-label">今週の変化</span>
            <span className="health-list-item-value">
              {diffWeight > 0 ? '+' : ''}{diffWeight.toFixed(1)}kg / {diffFat > 0 ? '+' : ''}{diffFat.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// CirculationTab Component
function CirculationTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<VitalsDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchVitalsData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setError("バイタルデータの取得に失敗しました。しばらく経ってから再度お試しください。"); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">読み込み中...</span></div>
  if (error) return <div className="health-empty-state health-error-state"><span className="health-empty-text" style={{ color: 'var(--danger-color)' }}>{error}</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">データがありません</span></div>

  const current = data.current
  const useAverageCard = segment !== 'week'
  const displaySystolic = useAverageCard ? (data.periodSummary.avg_systolic ?? current.systolic) : current.systolic
  const displayDiastolic = useAverageCard ? (data.periodSummary.avg_diastolic ?? current.diastolic) : current.diastolic
  const displayRestingHr = useAverageCard ? (data.periodSummary.avg_resting_hr ?? current.resting_hr) : current.resting_hr
  const displayHeartHr = useAverageCard ? (data.periodSummary.avg_heart_hr ?? current.heart_hr) : current.heart_hr
  const hasBpMetric = displaySystolic != null && displayDiastolic != null
  const hasRestingHrMetric = displayRestingHr != null
  const hasHeartHrMetric = displayHeartHr != null
  const hasHighBpMetric = data.periodSummary.high_bp_points != null
  const hasCurrentCard = hasBpMetric || hasRestingHrMetric || hasHeartHrMetric || hasHighBpMetric
  const monthTicks = segment === 'month' ? monthTickDates(data.series.map((item) => item.date), date) : undefined

  let bpStatus = '正常'
  let bpClass = 'good'
  if (displaySystolic != null && displayDiastolic != null) {
    if (displaySystolic >= 160 || displayDiastolic >= 100) { bpStatus = 'III度高血圧'; bpClass = 'danger' }
    else if (displaySystolic >= 145 || displayDiastolic >= 90) { bpStatus = 'II度高血圧'; bpClass = 'danger' }
    else if (displaySystolic >= 135 || displayDiastolic >= 85) { bpStatus = 'I度高血圧'; bpClass = 'warning' }
    else if (displaySystolic >= 125 || displayDiastolic >= 75) { bpStatus = '高値血圧'; bpClass = 'warning' }
  }
  const adviceResult = generateCirculationAdvice(
    displaySystolic,
    displayDiastolic,
    displayRestingHr,
    data.periodSummary.high_bp_points,
    segment
  )

  return (
    <div className="tab-content">
      <HealthAdviceCard advice={adviceResult} />
      {hasCurrentCard ? (
        <div className="health-current-card">
          {hasBpMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均血圧' : '血圧'}</span>
              <span className="health-metric-value">
                <span className={`status-badge ${bpClass}`} style={{ marginRight: 8 }}>{bpStatus}</span>
                {formatRounded(displaySystolic)}/{formatRounded(displayDiastolic)} mmHg
              </span>
            </div>
          ) : null}
          {hasRestingHrMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均安静時心拍' : '安静時心拍'}</span>
              <span className="health-metric-value">
                <span className={`status-badge ${displayRestingHr < 80 ? 'good' : 'warning'}`} style={{ marginRight: 8 }}>{displayRestingHr < 80 ? '良好' : '高め'}</span>
                {formatRounded(displayRestingHr)} bpm
              </span>
            </div>
          ) : null}
          {hasHeartHrMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均通常心拍' : '通常心拍'}</span>
              <span className="health-metric-value">
                <span className={`status-badge ${displayHeartHr < 100 ? 'good' : 'warning'}`} style={{ marginRight: 8 }}>{displayHeartHr < 100 ? '標準' : '高め'}</span>
                {formatRounded(displayHeartHr)} bpm
              </span>
            </div>
          ) : null}
          {hasHighBpMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{segment === 'week' ? '今週の高血圧判定日' : '期間内の高血圧判定日'}</span>
              <span className="health-metric-value">{data.periodSummary.high_bp_points} 日</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="health-chart-container">
        <div className="health-chart-title">血圧の推移</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={1}
            minHeight={220}
            initialDimension={{ width: 300, height: 220 }}
          >
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 10', 'auto']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={135} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '135', position: 'right', fontSize: 10 }} />
              <ReferenceLine y={85} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '85', position: 'right', fontSize: 10 }} />
              <Line type="monotone" dataKey="systolic" name="収縮期" stroke="#EF9A9A" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
              <Line type="monotone" dataKey="diastolic" name="拡張期" stroke="#90CAF9" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="health-chart-container">
        <div className="health-chart-title">心拍の推移</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={1}
            minHeight={220}
            initialDimension={{ width: 300, height: 220 }}
          >
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="resting_hr" name="安静時心拍" stroke="#7AA89C" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={true} />
              <Line type="monotone" dataKey="heart_hr" name="通常心拍" stroke="#F4A261" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// SleepTab Component
function SleepTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<SleepDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchSleepData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setError("睡眠データの取得に失敗しました。しばらく経ってから再度お試しください。"); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">読み込み中...</span></div>
  if (error) return <div className="health-empty-state health-error-state"><span className="health-empty-text" style={{ color: 'var(--danger-color)' }}>{error}</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">データがありません</span></div>

  const current = data.current
  const stages = data.stages
  const useAverageCard = segment !== 'week'
  const isWeek = segment === 'week'
  const displaySleepMinutes = useAverageCard ? (data.periodSummary.avg_sleep_min ?? current.sleep_minutes) : current.sleep_minutes
  const displayAvgSpo2 = current.avg_spo2
  const displayMinSpo2 = current.min_spo2
  const hasSleepTiming = isWeek && (current.bedtime != null || current.wake_time != null)
  const hasSleepMinuteMetric = displaySleepMinutes != null
  const hasSleepSpo2Metric = isWeek && (displayAvgSpo2 != null || displayMinSpo2 != null)
  const hasCurrentCard = hasSleepMinuteMetric || hasSleepTiming || hasSleepSpo2Metric
  const hasSleepStages = stages.deep_min != null || stages.light_min != null || stages.rem_min != null
  const monthTicks = segment === 'month' ? monthTickDates(data.series.map((item) => item.date), date) : undefined
  const weekStageTotal = (stages.deep_min ?? 0) + (stages.light_min ?? 0) + (stages.rem_min ?? 0)
  const periodStageTotal = (data.periodSummary.avg_deep_min ?? 0) + (data.periodSummary.avg_light_min ?? 0) + (data.periodSummary.avg_rem_min ?? 0)
  const deepSleepRatio = isWeek
    ? (stages.deep_min != null && weekStageTotal > 0 ? stages.deep_min / weekStageTotal : null)
    : (data.periodSummary.deep_ratio ?? (data.periodSummary.avg_deep_min != null && periodStageTotal > 0 ? data.periodSummary.avg_deep_min / periodStageTotal : null))
  const adviceSpo2 = isWeek ? current.avg_spo2 : (data.periodSummary.avg_spo2 ?? current.avg_spo2)
  const adviceResult = generateSleepAdvice(displaySleepMinutes, deepSleepRatio, adviceSpo2)

  const formatHours = (min: number | null | undefined) => {
    if (min == null) return '-'
    const h = Math.floor(min / 60)
    const m = Math.floor(min % 60)
    return `${h}時間${m}分`
  }
  const toPercentLabel = (ratio: number | null | undefined) => {
    if (ratio == null || !Number.isFinite(ratio)) return null
    const normalized = ratio <= 1 ? ratio * 100 : ratio
    return `${Math.round(normalized)}%`
  }
  const formatStageMetric = (minutes: number, ratio: number | null | undefined) => {
    const ratioLabel = toPercentLabel(ratio)
    return `${Math.round(minutes)}分${ratioLabel ? ` (${ratioLabel})` : ''}`
  }

  let sleepStatus = '短め'
  let sleepClass = 'danger'
  if (displaySleepMinutes != null) {
    if (displaySleepMinutes >= 420) { sleepStatus = '良好'; sleepClass = 'good' }
    else if (displaySleepMinutes >= 360) { sleepStatus = 'やや短め'; sleepClass = 'warning' }
  }
  const stageRows = isWeek
    ? [
      {
        key: 'deep',
        label: '深い睡眠',
        minutes: stages.deep_min,
        ratio: stages.deep_min != null && weekStageTotal > 0 ? stages.deep_min / weekStageTotal : null
      },
      {
        key: 'light',
        label: '浅い睡眠',
        minutes: stages.light_min,
        ratio: stages.light_min != null && weekStageTotal > 0 ? stages.light_min / weekStageTotal : null
      },
      {
        key: 'rem',
        label: 'レム睡眠',
        minutes: stages.rem_min,
        ratio: stages.rem_min != null && weekStageTotal > 0 ? stages.rem_min / weekStageTotal : null
      }
    ]
    : [
      {
        key: 'deep',
        label: '深い睡眠',
        minutes: data.periodSummary.avg_deep_min ?? null,
        ratio: data.periodSummary.deep_ratio ?? null
      },
      {
        key: 'light',
        label: '浅い睡眠',
        minutes: data.periodSummary.avg_light_min ?? null,
        ratio: data.periodSummary.light_ratio ?? null
      },
      {
        key: 'rem',
        label: 'レム睡眠',
        minutes: data.periodSummary.avg_rem_min ?? null,
        ratio: data.periodSummary.rem_ratio ?? null
      }
    ]
  const visibleStageRows = stageRows.filter((row) => row.minutes != null)
  const hasSleepStageCard = visibleStageRows.length > 0
  const showPeriodSummary = !isWeek
  const hasSummaryAverageSleep = showPeriodSummary && data.periodSummary.avg_sleep_min != null
  const hasSummaryGoalDays = showPeriodSummary && (data.periodSummary.measured_days ?? 0) > 0
  const goalRateLabel = hasSummaryGoalDays ? toPercentLabel(data.periodSummary.goal_rate ?? null) : null
  const showPeriodSpo2Summary = showPeriodSummary
  const hasSummaryAvgSpo2 = showPeriodSpo2Summary && data.periodSummary.avg_spo2 != null
  const hasSummaryMinSpo2 = showPeriodSpo2Summary && data.periodSummary.min_spo2 != null
  const hasSummaryList = hasSummaryAverageSleep || hasSummaryGoalDays || hasSummaryAvgSpo2 || hasSummaryMinSpo2

  // Convert minutes to hours for display
  const chartData = data.series.map(d => ({
    ...d,
    total_h: d.sleep_minutes != null ? Number((d.sleep_minutes / 60).toFixed(1)) : 0,
    deep_h: d.deep_min != null ? Number((d.deep_min / 60).toFixed(1)) : 0,
    light_h: d.light_min != null ? Number((d.light_min / 60).toFixed(1)) : 0,
    rem_h: d.rem_min != null ? Number((d.rem_min / 60).toFixed(1)) : 0,
  }))

  return (
    <div className="tab-content">
      <HealthAdviceCard advice={adviceResult} />
      {hasCurrentCard ? (
        <div className="health-current-card">
          {hasSleepMinuteMetric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">{useAverageCard ? '平均睡眠' : '睡眠'}</span>
              <span className="health-metric-value">
                <span className={`status-badge ${sleepClass}`} style={{ marginRight: 8 }}>{sleepStatus}</span>
                {formatHours(displaySleepMinutes)}
              </span>
            </div>
          ) : null}
          {hasSleepTiming ? (
            <div className="health-metric-row">
              <span className="health-metric-label">就寝 / 起床</span>
              <span className="health-metric-value">{`${current.bedtime ?? '-'} / ${current.wake_time ?? '-'}`}</span>
            </div>
          ) : null}
          {hasSleepSpo2Metric ? (
            <div className="health-metric-row">
              <span className="health-metric-label">血中酸素</span>
              <span className="health-metric-value" style={{ fontSize: '13px', fontWeight: 600 }}>
                {displayAvgSpo2 != null ? <span>平均: {formatRounded(displayAvgSpo2)}%</span> : null}
                {displayMinSpo2 != null ? <span>最低: {formatRounded(displayMinSpo2)}%</span> : null}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="health-chart-container">
        <div className="health-chart-title">睡眠時間の推移</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={1}
            minHeight={220}
            initialDimension={{ width: 300, height: 220 }}
          >
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" ticks={monthTicks} interval={segment === 'month' ? 0 : undefined} tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#5A7367' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={7} stroke="#5A7367" strokeDasharray="4 4" label={{ value: '目標7h', position: 'insideTopRight', fill: '#5A7367', fontSize: 10 }} />
              {hasSleepStages ? (
                <>
                  <Bar dataKey="deep_h" name="深睡眠" stackId="a" fill="#6BCB9F" radius={segment === 'week' ? [0, 0, 0, 0] : [0, 0, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
                  <Bar dataKey="light_h" name="浅睡眠" stackId="a" fill="#A5D6A7" radius={[0, 0, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
                  <Bar dataKey="rem_h" name="レム睡眠" stackId="a" fill="#FFCC80" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
                </>
              ) : (
                <Bar dataKey="total_h" name="睡眠時間" fill="var(--accent-color)" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {hasSleepStageCard ? (
        <div className="health-current-card health-stage-card">
          <div className="health-stage-card-title">{isWeek ? '睡眠ステージ' : '平均睡眠ステージ'}</div>
          {visibleStageRows.map((row) => (
            <div className="health-metric-row" key={row.key}>
              <span className="health-metric-label">{row.label}</span>
              <span className="health-metric-value">{formatStageMetric(row.minutes as number, row.ratio)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {hasSummaryList ? (
        <div className="health-list-container">
          {hasSummaryAverageSleep ? (
            <div className="health-list-item">
              <span className="health-list-item-label">平均睡眠</span>
              <span className="health-list-item-value">{formatHours(data.periodSummary.avg_sleep_min)}</span>
            </div>
          ) : null}
          {hasSummaryGoalDays ? (
            <div className="health-list-item">
              <span className="health-list-item-label">目標達成日</span>
              <span className="health-list-item-value">
                {formatRounded(data.periodSummary.goal_days)}日
                {goalRateLabel ? ` (${goalRateLabel})` : ''}
              </span>
            </div>
          ) : null}
          {hasSummaryAvgSpo2 ? (
            <div className="health-list-item">
              <span className="health-list-item-label">平均血中酸素</span>
              <span className="health-list-item-value">{formatRounded(data.periodSummary.avg_spo2)}%</span>
            </div>
          ) : null}
          {hasSummaryMinSpo2 ? (
            <div className="health-list-item">
              <span className="health-list-item-label">最低血中酸素</span>
              <span className="health-list-item-value">{formatRounded(data.periodSummary.min_spo2)}%</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function HealthScreen({ initialTab = 'composition' }: { initialTab?: InnerTab }) {
  const { activeDate } = useDateContext()
  const [tab, setTab] = useState<InnerTab>(initialTab)
  const [segment, setSegment] = useState<Segment>('week')

  return (
    <div className="health-container">
      <DateNavBar />
      <InnerTabBar tab={tab} onTabChange={setTab} />
      <SegmentSelector value={segment} onChange={(v: string) => setSegment(v as Segment)} />
      {tab === 'composition' && <CompositionTab date={activeDate} segment={segment} />}
      {tab === 'circulation' && <CirculationTab date={activeDate} segment={segment} />}
      {tab === 'sleep' && <SleepTab date={activeDate} segment={segment} />}
    </div>
  )
}

