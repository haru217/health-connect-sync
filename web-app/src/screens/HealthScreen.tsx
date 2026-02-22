import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchProfile, fetchSummary } from '../api/healthApi'
import type { ProfileResponse, RequestState, SummaryResponse } from '../api/types'
import './HealthScreen.css'

type HealthTab = 'composition' | 'circulation' | 'sleep'
type CompositionRange = 14 | 30 | 90
type CirculationRange = 14 | 30

interface HealthData {
  summary: SummaryResponse
  profile: ProfileResponse
}

interface CompositionPoint {
  date: string
  label: string
  weight: number | null
  bodyFat: number | null
}

interface BloodPressurePoint {
  date: string
  label: string
  systolic: number | null
  diastolic: number | null
}

interface RestingPoint {
  date: string
  label: string
  bpm: number | null
}

interface SleepPoint {
  date: string
  label: string
  hours: number | null
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

function toDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

function buildDateRange(days: number): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    out.push(date.toLocaleDateString('sv-SE'))
  }
  return out
}

function latestByDate<T extends { date: string }>(series: T[]): T | null {
  if (series.length === 0) {
    return null
  }
  return [...series].sort((a, b) => a.date.localeCompare(b.date))[series.length - 1] ?? null
}

function averageRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value != null)
  if (recorded.length === 0) {
    return null
  }
  return recorded.reduce((sum, value) => sum + value, 0) / recorded.length
}

function maxRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value != null)
  if (recorded.length === 0) {
    return null
  }
  return Math.max(...recorded)
}

function minRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value != null)
  if (recorded.length === 0) {
    return null
  }
  return Math.min(...recorded)
}

function toBodyFatSeries(summary: SummaryResponse): Array<{ date: string; pct: number }> {
  if (summary.bodyFatByDate && summary.bodyFatByDate.length > 0) {
    return summary.bodyFatByDate.map((item) => ({ date: item.date, pct: item.percentage }))
  }
  return summary.bodyFatPctByDate.map((item) => ({ date: item.date, pct: item.pct }))
}

function toRestingSeries(summary: SummaryResponse): Array<{ date: string; bpm: number }> {
  if (summary.restingHeartRateByDate && summary.restingHeartRateByDate.length > 0) {
    return summary.restingHeartRateByDate.map((item) => ({ date: item.date, bpm: item.bpm }))
  }
  return summary.restingHeartRateBpmByDate.map((item) => ({ date: item.date, bpm: item.bpm }))
}

function toSpo2Series(summary: SummaryResponse): Array<{ date: string; pct: number }> {
  if (summary.oxygenSaturationByDate && summary.oxygenSaturationByDate.length > 0) {
    return summary.oxygenSaturationByDate.map((item) => ({ date: item.date, pct: item.percentage }))
  }
  return summary.oxygenSaturationPctByDate.map((item) => ({ date: item.date, pct: item.pct }))
}

function toBmrSeries(summary: SummaryResponse): Array<{ date: string; kcalPerDay: number }> {
  if (summary.bmrByDate && summary.bmrByDate.length > 0) {
    return summary.bmrByDate
  }
  return summary.basalMetabolicRateKcalByDate.map((item) => ({
    date: item.date,
    kcalPerDay: item.kcalPerDay,
  }))
}

function compositionPoints(summary: SummaryResponse, days: number): CompositionPoint[] {
  const dates = buildDateRange(days)
  const weightMap = new Map(summary.weightByDate.map((item) => [item.date, item.kg]))
  const bodyFatMap = new Map(toBodyFatSeries(summary).map((item) => [item.date, item.pct]))
  return dates.map((date) => ({
    date,
    label: toDateLabel(date),
    weight: weightMap.get(date) ?? null,
    bodyFat: bodyFatMap.get(date) ?? null,
  }))
}

function bloodPressurePoints(summary: SummaryResponse, days: number): BloodPressurePoint[] {
  const dates = buildDateRange(days)
  const bloodSeries = summary.bloodPressureByDate ?? []
  const systolicMap = new Map(bloodSeries.map((item) => [item.date, item.systolic]))
  const diastolicMap = new Map(bloodSeries.map((item) => [item.date, item.diastolic]))
  return dates.map((date) => ({
    date,
    label: toDateLabel(date),
    systolic: systolicMap.get(date) ?? null,
    diastolic: diastolicMap.get(date) ?? null,
  }))
}

function restingPoints(summary: SummaryResponse, days: number): RestingPoint[] {
  const dates = buildDateRange(days)
  const restingMap = new Map(toRestingSeries(summary).map((item) => [item.date, item.bpm]))
  return dates.map((date) => ({
    date,
    label: toDateLabel(date),
    bpm: restingMap.get(date) ?? null,
  }))
}

function sleepPoints(summary: SummaryResponse): SleepPoint[] {
  const dates = buildDateRange(7)
  const sleepMap = new Map(summary.sleepHoursByDate.map((item) => [item.date, item.hours]))
  return dates.map((date) => ({
    date,
    label: toDateLabel(date),
    hours: sleepMap.get(date) ?? null,
  }))
}

function bmiLabel(value: number | null): string {
  if (value == null) {
    return '--'
  }
  if (value < 18.5) {
    return '低体重'
  }
  if (value < 25.0) {
    return '標準'
  }
  if (value < 30.0) {
    return '過体重'
  }
  return '肥満'
}

function bodyFatLabel(value: number | null, sex: ProfileResponse['sex']): string {
  if (value == null) {
    return '--'
  }
  const isFemale = sex === 'female'
  if (isFemale) {
    if (value < 18) return '低'
    if (value <= 28) return '標準'
    if (value <= 33) return 'やや高'
    return '高'
  }
  if (value < 10) return '低'
  if (value <= 20) return '標準'
  if (value <= 25) return 'やや高'
  return '高'
}

function bloodPressureRisk(systolic: number | null, diastolic: number | null): {
  label: string
  tone: 'good' | 'warning' | 'danger'
} {
  if (systolic == null || diastolic == null) {
    return { label: '--', tone: 'warning' }
  }
  if (systolic >= 140 || diastolic >= 90) {
    return { label: '要確認', tone: 'danger' }
  }
  if (systolic >= 120 || diastolic >= 80) {
    return { label: '注意', tone: 'warning' }
  }
  return { label: '正常', tone: 'good' }
}

function weeklyChange(series: Array<{ date: string; value: number }>): number | null {
  if (series.length < 2) {
    return null
  }
  const tail = series.slice(-7)
  const first = tail[0]
  const last = tail[tail.length - 1]
  if (!first || !last) {
    return null
  }
  const days = Math.max(
    1,
    Math.round((new Date(`${last.date}T00:00:00`).getTime() - new Date(`${first.date}T00:00:00`).getTime()) / 86400000),
  )
  return ((last.value - first.value) / days) * 7
}

export default function HealthScreen() {
  const [tab, setTab] = useState<HealthTab>('composition')
  const [compositionRange, setCompositionRange] = useState<CompositionRange>(14)
  const [circulationRange, setCirculationRange] = useState<CirculationRange>(14)
  const [state, setState] = useState<RequestState<HealthData>>({ status: 'loading' })
  const [compositionIndex, setCompositionIndex] = useState<number | null>(null)
  const [bloodPressureIndex, setBloodPressureIndex] = useState<number | null>(null)
  const [restingIndex, setRestingIndex] = useState<number | null>(null)
  const [sleepIndex, setSleepIndex] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [summary, profile] = await Promise.all([fetchSummary(), fetchProfile()])
        if (!alive) {
          return
        }
        setState({ status: 'success', data: { summary, profile } })
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
      <div className="health-container fade-in">
        <div className="card">読み込み中...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="health-container fade-in">
        <div className="card">読み込みエラー: {state.error}</div>
      </div>
    )
  }

  const { summary, profile } = state.data
  const bodyFatSeries = toBodyFatSeries(summary)
  const spo2Series = toSpo2Series(summary)
  const restingSeries = toRestingSeries(summary)
  const bmrSeries = toBmrSeries(summary)
  const bloodSeries = summary.bloodPressureByDate ?? []

  const compositionData = compositionPoints(summary, compositionRange)
  const bloodPressureData = bloodPressurePoints(summary, circulationRange)
  const restingData = restingPoints(summary, circulationRange)
  const sleepData = sleepPoints(summary)

  const latestWeight = latestByDate(summary.weightByDate)?.kg ?? null
  const latestBodyFat = latestByDate(bodyFatSeries)?.pct ?? null
  const latestBmr = latestByDate(bmrSeries)?.kcalPerDay ?? null
  const latestSpo2 = latestByDate(spo2Series)?.pct ?? null
  const latestResting = latestByDate(restingSeries)?.bpm ?? null
  const latestBlood = latestByDate(bloodSeries) ?? null
  const goalWeight = profile.goal_weight_kg ?? null
  const heightM = summary.heightM ?? (profile.height_cm != null ? profile.height_cm / 100 : null)
  const bmi = latestWeight != null && heightM != null && heightM > 0 ? latestWeight / (heightM * heightM) : null
  const remainingWeight =
    goalWeight != null && latestWeight != null ? goalWeight - latestWeight : null
  const bpRisk = bloodPressureRisk(latestBlood?.systolic ?? null, latestBlood?.diastolic ?? null)

  const weightChange = weeklyChange(summary.weightByDate.map((item) => ({ date: item.date, value: item.kg })))
  const bodyFatChange = weeklyChange(bodyFatSeries.map((item) => ({ date: item.date, value: item.pct })))
  const bodyFatText = bodyFatLabel(latestBodyFat, profile.sex)

  const sleepAverage = averageRecorded(sleepData.map((item) => item.hours))
  const sleepLongest = maxRecorded(sleepData.map((item) => item.hours))
  const sleepShortest = minRecorded(sleepData.map((item) => item.hours))
  const sleepGoalDays = sleepData.filter((item) => (item.hours ?? 0) >= 7).length

  const selectedComposition = compositionIndex != null ? compositionData[compositionIndex] : null
  const selectedBloodPressure = bloodPressureIndex != null ? bloodPressureData[bloodPressureIndex] : null
  const selectedResting = restingIndex != null ? restingData[restingIndex] : null
  const selectedSleep = sleepIndex != null ? sleepData[sleepIndex] : null

  const weightValues = compositionData
    .map((item) => item.weight)
    .filter((value): value is number => value != null)
  const weightDomain: [number, number] | ['auto', 'auto'] =
    weightValues.length > 0
      ? [Math.floor(Math.min(...weightValues) - 1), Math.ceil(Math.max(...weightValues) + 1)]
      : ['auto', 'auto']

  return (
    <div className="health-container fade-in">
      <div className="health-tab-row">
        <button
          type="button"
          className={`health-tab-btn ${tab === 'composition' ? 'active' : ''}`}
          onClick={() => setTab('composition')}
        >
          体組成
        </button>
        <button
          type="button"
          className={`health-tab-btn ${tab === 'circulation' ? 'active' : ''}`}
          onClick={() => setTab('circulation')}
        >
          循環器
        </button>
        <button
          type="button"
          className={`health-tab-btn ${tab === 'sleep' ? 'active' : ''}`}
          onClick={() => setTab('sleep')}
        >
          睡眠
        </button>
      </div>

      {tab === 'composition' && (
        <>
          <section className="card">
            <div className="health-card-header">
              <h3 className="health-title">体重・体脂肪トレンド</h3>
              <div className="health-range-row">
                <button
                  type="button"
                  className={`health-range-btn ${compositionRange === 14 ? 'active' : ''}`}
                  onClick={() => {
                    setCompositionRange(14)
                    setCompositionIndex(null)
                  }}
                >
                  2週
                </button>
                <button
                  type="button"
                  className={`health-range-btn ${compositionRange === 30 ? 'active' : ''}`}
                  onClick={() => {
                    setCompositionRange(30)
                    setCompositionIndex(null)
                  }}
                >
                  1ヶ月
                </button>
                <button
                  type="button"
                  className={`health-range-btn ${compositionRange === 90 ? 'active' : ''}`}
                  onClick={() => {
                    setCompositionRange(90)
                    setCompositionIndex(null)
                  }}
                >
                  3ヶ月
                </button>
              </div>
            </div>
            {selectedComposition ? (
              <p className="health-selected-value">
                {selectedComposition.label} 体重 {formatNullable(selectedComposition.weight, 1)}kg / 体脂肪{' '}
                {formatNullable(selectedComposition.bodyFat, 1)}%
              </p>
            ) : (
              <p className="health-selected-value">線をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={compositionData}
                  onClick={(event) => {
                    if (event && typeof event.activeTooltipIndex === 'number') {
                      setCompositionIndex(event.activeTooltipIndex)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis
                    yAxisId="left"
                    domain={weightDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#8FA39A' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#8FA39A' }}
                  />
                  <Line
                    yAxisId="left"
                    dataKey="weight"
                    stroke="var(--accent-color)"
                    strokeWidth={3}
                    dot={(props: { cx?: number; cy?: number; index?: number }) => {
                      if (props.cx == null || props.cy == null || props.index == null) {
                        return null
                      }
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={props.index === compositionIndex ? 5 : 3.5}
                          fill={props.index === compositionIndex ? 'var(--accent-color)' : '#9acfb8'}
                        />
                      )
                    }}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="bodyFat"
                    stroke="var(--warning-color)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3 className="health-title">現在値</h3>
            <div className="health-metric-grid">
              <div className="health-metric-item">
                <span>体重</span>
                <strong>{formatNullable(latestWeight, 1)} kg</strong>
              </div>
              <div className="health-metric-item">
                <span>目標体重</span>
                <strong>{formatNullable(goalWeight, 1)} kg</strong>
              </div>
              <div className="health-metric-item">
                <span>残り</span>
                <strong>{remainingWeight == null ? '--' : `${remainingWeight.toFixed(1)} kg`}</strong>
              </div>
              <div className="health-metric-item">
                <span>体脂肪</span>
                <strong>{formatNullable(latestBodyFat, 1)} %</strong>
              </div>
              <div className="health-metric-item">
                <span>BMI</span>
                <strong>
                  {formatNullable(bmi, 1)} {bmiLabel(bmi)}
                </strong>
              </div>
              <div className="health-metric-item">
                <span>BMR</span>
                <strong>{formatNullable(latestBmr, 0)} kcal/日</strong>
              </div>
            </div>
            <p className="health-note">体脂肪判定: {bodyFatText}</p>
          </section>

          <section className="card">
            <h3 className="health-title">変化速度</h3>
            <div className="health-change-row">
              <span>体重変化</span>
              <strong>{weightChange == null ? '--' : `${weightChange.toFixed(2)} kg/週`}</strong>
            </div>
            <div className="health-change-row">
              <span>体脂肪変化</span>
              <strong>{bodyFatChange == null ? '--' : `${bodyFatChange.toFixed(2)} %/週`}</strong>
            </div>
          </section>
        </>
      )}

      {tab === 'circulation' && (
        <>
          <section className="card">
            <div className="health-card-header">
              <h3 className="health-title">血圧トレンド</h3>
              <div className="health-range-row">
                <button
                  type="button"
                  className={`health-range-btn ${circulationRange === 14 ? 'active' : ''}`}
                  onClick={() => {
                    setCirculationRange(14)
                    setBloodPressureIndex(null)
                  }}
                >
                  2週
                </button>
                <button
                  type="button"
                  className={`health-range-btn ${circulationRange === 30 ? 'active' : ''}`}
                  onClick={() => {
                    setCirculationRange(30)
                    setBloodPressureIndex(null)
                  }}
                >
                  1ヶ月
                </button>
              </div>
            </div>
            {selectedBloodPressure ? (
              <p className="health-selected-value">
                {selectedBloodPressure.label} {formatNullable(selectedBloodPressure.systolic, 0)} /{' '}
                {formatNullable(selectedBloodPressure.diastolic, 0)} mmHg
              </p>
            ) : (
              <p className="health-selected-value">線をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={bloodPressureData}
                  onClick={(event) => {
                    if (event && typeof event.activeTooltipIndex === 'number') {
                      setBloodPressureIndex(event.activeTooltipIndex)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <ReferenceLine y={120} stroke="#e59e8d" strokeDasharray="4 4" />
                  <ReferenceLine y={80} stroke="#87a1d2" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="systolic" stroke="#f08d7f" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="diastolic" stroke="#78a2dc" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3 className="health-title">最新値</h3>
            <div className="health-latest-row">
              <strong>
                血圧:{' '}
                {latestBlood == null
                  ? '-- / --'
                  : `${Math.round(latestBlood.systolic)} / ${Math.round(latestBlood.diastolic)}`}{' '}
                mmHg
              </strong>
            </div>
            <p className={`health-status ${bpRisk.tone}`}>{bpRisk.label}</p>
          </section>

          <section className="card">
            <h3 className="health-title">安静時心拍トレンド</h3>
            {selectedResting ? (
              <p className="health-selected-value">
                {selectedResting.label}: {formatNullable(selectedResting.bpm, 0)} bpm
              </p>
            ) : (
              <p className="health-selected-value">線をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={restingData}
                  onClick={(event) => {
                    if (event && typeof event.activeTooltipIndex === 'number') {
                      setRestingIndex(event.activeTooltipIndex)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <Line
                    type="monotone"
                    dataKey="bpm"
                    stroke="var(--danger-color)"
                    strokeWidth={2.8}
                    dot={(props: { cx?: number; cy?: number; index?: number }) => {
                      if (props.cx == null || props.cy == null || props.index == null) {
                        return null
                      }
                      const selected = props.index === restingIndex
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={selected ? 5 : 3.5}
                          fill={selected ? 'var(--accent-color)' : 'var(--danger-color)'}
                        />
                      )
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="health-note">
              最新: {formatNullable(latestResting, 0)} bpm / SpO₂: {formatNullable(latestSpo2, 1)}%
            </p>
          </section>
        </>
      )}

      {tab === 'sleep' && (
        <>
          <section className="card">
            <h3 className="health-title">睡眠時間グラフ（7日）</h3>
            {selectedSleep ? (
              <p className="health-selected-value">
                {selectedSleep.label}: {formatNullable(selectedSleep.hours, 2)} h
              </p>
            ) : (
              <p className="health-selected-value">棒をタップして値を表示</p>
            )}
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sleepData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                  <ReferenceLine y={7} stroke="#9fb1ad" strokeDasharray="4 4" />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} onClick={(_, index) => setSleepIndex(index)}>
                    {sleepData.map((_, index) => (
                      <Cell
                        key={`sleep-${index}`}
                        fill={index === sleepIndex ? 'var(--accent-color)' : 'rgba(136, 212, 180, 0.45)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card">
            <h3 className="health-title">今週のサマリー</h3>
            <div className="health-change-row">
              <span>平均睡眠</span>
              <strong>{sleepAverage == null ? '--' : `${sleepAverage.toFixed(2)} h`}</strong>
            </div>
            <div className="health-change-row">
              <span>目標達成</span>
              <strong>{sleepGoalDays} / 7 日</strong>
            </div>
            <div className="health-change-row">
              <span>最長 / 最短</span>
              <strong>
                {sleepLongest == null ? '--' : `${sleepLongest.toFixed(2)} h`} /{' '}
                {sleepShortest == null ? '--' : `${sleepShortest.toFixed(2)} h`}
              </strong>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
