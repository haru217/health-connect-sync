import { useEffect, useMemo, useState } from 'react'
import { fetchSummary } from '../api/healthApi'
import type { RequestState, SummaryResponse } from '../api/types'
import './HomeScreen.css'

interface HomeMetrics {
  insight: string
  selectedDateLabel: string
  steps: number | null
  distanceKm: number | null
  activeKcal: number | null
  intakeKcal: number | null
  totalKcal: number | null
  balanceKcal: number | null
  balanceLabel: string
  balanceTone: 'good' | 'warning' | 'danger'
  weightKg: number | null
  bodyFatPct: number | null
  bmi: number | null
  bmiLabel: string
  restingBpm: number | null
  bloodPressure: { systolic: number; diastolic: number } | null
  bloodPressureLabel: string
  bloodPressureTone: 'good' | 'warning' | 'danger'
  spo2Pct: number | null
  sleepHours: number | null
  sleepLabel: string
  sleepTone: 'good' | 'warning' | 'danger'
  stepProgress: number | null
  calorieProgress: number | null
  sleepProgress: number | null
}

function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function addDays(baseDate: string, diffDays: number): string {
  const base = new Date(`${baseDate}T00:00:00`)
  base.setDate(base.getDate() + diffDays)
  return base.toLocaleDateString('sv-SE')
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
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

function bloodPressureRisk(
  systolic: number | null,
  diastolic: number | null,
): { label: string; tone: 'good' | 'warning' | 'danger' } {
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

function bmiStatus(bmi: number | null): string {
  if (bmi == null) return '--'
  if (bmi < 18.5) return '低体重'
  if (bmi < 25) return '標準'
  if (bmi < 30) return '過体重'
  return '肥満'
}

function valueOnDate<T extends { date: string }>(
  series: T[],
  date: string,
  valueSelector: (item: T) => number,
): number | null {
  const point = series.find((item) => item.date === date)
  if (!point) {
    return null
  }
  const value = valueSelector(point)
  return Number.isFinite(value) ? value : null
}

function latestOnOrBefore<T extends { date: string }>(series: T[], date: string): T | null {
  const candidates = series
    .filter((item) => item.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (candidates.length === 0) {
    return null
  }
  return candidates[candidates.length - 1] ?? null
}

function toHomeMetrics(summary: SummaryResponse, selectedDate: string): HomeMetrics {
  const distanceSeries =
    summary.distanceByDate?.map((item) => ({ date: item.date, km: item.meters / 1000 })) ??
    summary.distanceKmByDate
  const activeSeries = summary.activeCalByDate ?? summary.activeCaloriesByDate
  const totalSeries = summary.totalCalByDate ?? summary.totalCaloriesByDate
  const bodyFatSeries =
    summary.bodyFatByDate?.map((item) => ({ date: item.date, pct: item.percentage })) ??
    summary.bodyFatPctByDate
  const spo2Series =
    summary.oxygenSaturationByDate?.map((item) => ({ date: item.date, pct: item.percentage })) ??
    summary.oxygenSaturationPctByDate
  const restingSeries = summary.restingHeartRateByDate ?? summary.restingHeartRateBpmByDate
  const bloodPressureSeries = summary.bloodPressureByDate ?? []

  const steps = valueOnDate(summary.stepsByDate, selectedDate, (item) => item.steps)
  const distanceKm = valueOnDate(distanceSeries, selectedDate, (item) => item.km)
  const activeKcal = valueOnDate(activeSeries, selectedDate, (item) => item.kcal)
  const intakeKcal = valueOnDate(summary.intakeCaloriesByDate, selectedDate, (item) => item.kcal)
  const totalKcal = valueOnDate(totalSeries, selectedDate, (item) => item.kcal)
  const sleepHours = valueOnDate(summary.sleepHoursByDate, selectedDate, (item) => item.hours)

  const latestWeight = latestOnOrBefore(summary.weightByDate, selectedDate)
  const latestBodyFat = latestOnOrBefore(bodyFatSeries, selectedDate)
  const latestSpo2 = latestOnOrBefore(spo2Series, selectedDate)
  const latestResting = latestOnOrBefore(restingSeries, selectedDate)
  const latestBloodPressure = latestOnOrBefore(bloodPressureSeries, selectedDate)

  const weightKg = latestWeight?.kg ?? null
  const heightM = summary.heightM ?? null
  const bmi = weightKg != null && heightM != null && heightM > 0 ? weightKg / (heightM * heightM) : null

  const bp = latestBloodPressure
    ? { systolic: latestBloodPressure.systolic, diastolic: latestBloodPressure.diastolic }
    : null
  const bpRisk = bloodPressureRisk(bp?.systolic ?? null, bp?.diastolic ?? null)

  const balanceKcal =
    intakeKcal != null && totalKcal != null ? Number((intakeKcal - totalKcal).toFixed(0)) : null
  let balanceLabel = '--'
  let balanceTone: 'good' | 'warning' | 'danger' = 'warning'
  if (balanceKcal != null) {
    if (balanceKcal < -150) {
      balanceLabel = '減量中'
      balanceTone = 'good'
    } else if (balanceKcal > 150) {
      balanceLabel = '増量寄り'
      balanceTone = 'danger'
    } else {
      balanceLabel = '維持'
      balanceTone = 'warning'
    }
  }

  let sleepLabel = '--'
  let sleepTone: 'good' | 'warning' | 'danger' = 'warning'
  if (sleepHours != null) {
    if (sleepHours >= 7) {
      sleepLabel = '良好'
      sleepTone = 'good'
    } else if (sleepHours >= 6) {
      sleepLabel = 'やや短め'
      sleepTone = 'warning'
    } else {
      sleepLabel = '短め'
      sleepTone = 'danger'
    }
  }

  return {
    insight:
      summary.insights[0]?.message ??
      '最新データを同期するとここに一言アドバイスが表示されます。',
    selectedDateLabel: formatDateLabel(selectedDate),
    steps,
    distanceKm,
    activeKcal,
    intakeKcal,
    totalKcal,
    balanceKcal,
    balanceLabel,
    balanceTone,
    weightKg,
    bodyFatPct: latestBodyFat?.pct ?? null,
    bmi,
    bmiLabel: bmiStatus(bmi),
    restingBpm: latestResting?.bpm ?? null,
    bloodPressure: bp,
    bloodPressureLabel: bpRisk.label,
    bloodPressureTone: bpRisk.tone,
    spo2Pct: latestSpo2?.pct ?? null,
    sleepHours,
    sleepLabel,
    sleepTone,
    stepProgress: steps != null ? Math.min(100, (steps / 10000) * 100) : null,
    calorieProgress:
      balanceKcal != null ? Math.min(100, (Math.abs(balanceKcal) / 600) * 100) : null,
    sleepProgress: sleepHours != null ? Math.min(100, (sleepHours / 8) * 100) : null,
  }
}

function ProgressBar({
  progress,
  tone,
}: {
  progress: number | null
  tone: 'good' | 'warning' | 'danger'
}) {
  if (progress == null) {
    return <div className="home-progress-empty">--</div>
  }
  return (
    <div className="home-progress-track">
      <div className={`home-progress-fill ${tone}`} style={{ width: `${progress}%` }} />
    </div>
  )
}

export default function HomeScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal())
  const [state, setState] = useState<RequestState<SummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const summary = await fetchSummary()
        if (!alive) return
        setState({ status: 'success', data: summary })
      } catch (error) {
        if (!alive) return
        const message = error instanceof Error ? error.message : '不明なエラー'
        setState({ status: 'error', error: message })
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const today = todayLocal()
  const canGoNext = selectedDate < today
  const metrics = useMemo(
    () => (state.status === 'success' ? toHomeMetrics(state.data, selectedDate) : null),
    [selectedDate, state],
  )

  if (state.status === 'loading' || metrics == null) {
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

  return (
    <div className="home-container fade-in">
      <div className="home-date-selector">
        <button className="home-date-btn" onClick={() => setSelectedDate((prev) => addDays(prev, -1))}>
          ‹
        </button>
        <div className="home-date-current">{metrics.selectedDateLabel}</div>
        <button
          className="home-date-btn"
          disabled={!canGoNext}
          onClick={() => setSelectedDate((prev) => (prev < today ? addDays(prev, 1) : prev))}
        >
          ›
        </button>
      </div>

      <section className="home-insight-section">
        <div className="home-insight-avatar">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div className="home-insight-bubble">
          <p className="home-insight-text">{metrics.insight}</p>
        </div>
      </section>

      <section className="card">
        <h3 className="home-card-title">選択日のアクティビティ</h3>
        <div className="home-metric-grid three-col">
          <div className="home-metric">
            <div className="home-metric-label">歩数</div>
            <div className="home-metric-value">
              {formatNullable(metrics.steps, 0)}
              <span className="home-unit">歩</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">距離</div>
            <div className="home-metric-value">
              {formatNullable(metrics.distanceKm, 1)}
              <span className="home-unit">km</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">活動カロリー</div>
            <div className="home-metric-value">
              {formatNullable(metrics.activeKcal, 0)}
              <span className="home-unit">kcal</span>
            </div>
          </div>
        </div>
        <div className="home-progress-row">
          <span>歩数目標 10,000歩</span>
          <ProgressBar progress={metrics.stepProgress} tone="good" />
        </div>
      </section>

      <section className="card">
        <h3 className="home-card-title">カロリー収支</h3>
        <div className="home-balance-grid">
          <div className="home-balance-row">
            <span>摂取</span>
            <strong>{formatNullable(metrics.intakeKcal, 0)} kcal</strong>
          </div>
          <div className="home-balance-row">
            <span>消費</span>
            <strong>{formatNullable(metrics.totalKcal, 0)} kcal</strong>
          </div>
          <div className="home-balance-row">
            <span>収支</span>
            <strong>
              {metrics.balanceKcal == null
                ? '--'
                : `${metrics.balanceKcal > 0 ? '+' : ''}${formatNullable(metrics.balanceKcal, 0)}`}{' '}
              kcal
            </strong>
          </div>
        </div>
        <div className="home-progress-row">
          <span className={`home-status ${metrics.balanceTone}`}>{metrics.balanceLabel}</span>
          <ProgressBar progress={metrics.calorieProgress} tone={metrics.balanceTone} />
        </div>
      </section>

      <section className="card">
        <h3 className="home-card-title">バイタル（直近値）</h3>
        <div className="home-metric-grid two-col">
          <div className="home-metric">
            <div className="home-metric-label">体重</div>
            <div className="home-metric-value">
              {formatNullable(metrics.weightKg, 1)}
              <span className="home-unit">kg</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">体脂肪</div>
            <div className="home-metric-value">
              {formatNullable(metrics.bodyFatPct, 1)}
              <span className="home-unit">%</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">BMI</div>
            <div className="home-metric-value">
              {formatNullable(metrics.bmi, 1)}
              <span className="home-unit">{metrics.bmiLabel}</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">安静時心拍</div>
            <div className="home-metric-value">
              {formatNullable(metrics.restingBpm, 0)}
              <span className="home-unit">bpm</span>
            </div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">血圧</div>
            <div className="home-metric-value">
              {metrics.bloodPressure == null
                ? '-- / --'
                : `${Math.round(metrics.bloodPressure.systolic)}/${Math.round(metrics.bloodPressure.diastolic)}`}
            </div>
            <div className={`home-sub-status ${metrics.bloodPressureTone}`}>{metrics.bloodPressureLabel}</div>
          </div>
          <div className="home-metric">
            <div className="home-metric-label">SpO₂</div>
            <div className="home-metric-value">
              {formatNullable(metrics.spo2Pct, 1)}
              <span className="home-unit">%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="home-card-title">睡眠</h3>
        <div className="home-sleep-row">
          <div className="home-metric-value">
            {formatNullable(metrics.sleepHours, 2)}
            <span className="home-unit">h</span>
          </div>
          <span className={`home-status ${metrics.sleepTone}`}>{metrics.sleepLabel}</span>
        </div>
        <ProgressBar progress={metrics.sleepProgress} tone={metrics.sleepTone} />
      </section>
    </div>
  )
}
