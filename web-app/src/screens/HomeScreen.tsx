import { useEffect, useState } from 'react'
import { fetchSummary } from '../api/healthApi'
import type { RequestState, SummaryResponse } from '../api/types'
import './HomeScreen.css'

interface HomeMetrics {
  insight: string
  todayLabel: string
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

function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

function latestByDate<T extends { date: string }>(series: T[]): T | null {
  if (series.length === 0) {
    return null
  }
  return [...series].sort((a, b) => a.date.localeCompare(b.date))[series.length - 1] ?? null
}

function todayOrLatestByDate<T extends { date: string }>(series: T[]): T | null {
  const today = todayLocal()
  const todayValue = series.find((item) => item.date === today)
  if (todayValue) {
    return todayValue
  }
  return latestByDate(series)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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
  if (bmi == null) {
    return '--'
  }
  if (bmi < 18.5) {
    return '低体重'
  }
  if (bmi < 25) {
    return '標準'
  }
  if (bmi < 30) {
    return '過体重'
  }
  return '肥満'
}

function toHomeMetrics(summary: SummaryResponse): HomeMetrics {
  const today = todayLocal()

  const todaySteps = todayOrLatestByDate(summary.stepsByDate)
  const distanceSeries =
    summary.distanceByDate?.map((item) => ({ date: item.date, km: item.meters / 1000 })) ??
    summary.distanceKmByDate
  const todayDistance = todayOrLatestByDate(distanceSeries)

  const activeSeries = summary.activeCalByDate ?? summary.activeCaloriesByDate
  const totalSeries = summary.totalCalByDate ?? summary.totalCaloriesByDate
  const todayActive = todayOrLatestByDate(activeSeries)
  const todayTotal = todayOrLatestByDate(totalSeries)
  const todayIntake = todayOrLatestByDate(summary.intakeCaloriesByDate)

  const bodyFatSeries =
    summary.bodyFatByDate?.map((item) => ({ date: item.date, pct: item.percentage })) ??
    summary.bodyFatPctByDate
  const spo2Series =
    summary.oxygenSaturationByDate?.map((item) => ({ date: item.date, pct: item.percentage })) ??
    summary.oxygenSaturationPctByDate
  const restingSeries = summary.restingHeartRateByDate ?? summary.restingHeartRateBpmByDate
  const bloodPressureSeries = summary.bloodPressureByDate ?? []

  const latestWeight = latestByDate(summary.weightByDate)
  const latestBodyFat = latestByDate(bodyFatSeries)
  const latestSpo2 = latestByDate(spo2Series)
  const latestResting = latestByDate(restingSeries)
  const latestBloodPressure = latestByDate(bloodPressureSeries)
  const latestSleep = todayOrLatestByDate(summary.sleepHoursByDate)

  const weight = asNumber(latestWeight?.kg)
  const height = asNumber(summary.heightM)
  const bmi = weight != null && height != null && height > 0 ? weight / (height * height) : null
  const bp = latestBloodPressure
    ? {
        systolic: latestBloodPressure.systolic,
        diastolic: latestBloodPressure.diastolic,
      }
    : null
  const bpRisk = bloodPressureRisk(bp?.systolic ?? null, bp?.diastolic ?? null)

  const intakeKcal = asNumber(todayIntake?.kcal)
  const totalKcal = asNumber(todayTotal?.kcal)
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

  const sleepHours = asNumber(latestSleep?.hours)
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
    todayLabel: formatDateLabel(today),
    steps: asNumber(todaySteps?.steps),
    distanceKm: asNumber(todayDistance?.km),
    activeKcal: asNumber(todayActive?.kcal),
    intakeKcal,
    totalKcal,
    balanceKcal,
    balanceLabel,
    balanceTone,
    weightKg: weight,
    bodyFatPct: asNumber(latestBodyFat?.pct),
    bmi,
    bmiLabel: bmiStatus(bmi),
    restingBpm: asNumber(latestResting?.bpm),
    bloodPressure: bp,
    bloodPressureLabel: bpRisk.label,
    bloodPressureTone: bpRisk.tone,
    spo2Pct: asNumber(latestSpo2?.pct),
    sleepHours,
    sleepLabel,
    sleepTone,
    stepProgress: todaySteps?.steps != null ? Math.min(100, (todaySteps.steps / 10000) * 100) : null,
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

  return (
    <div className="home-container fade-in">
      <section className="home-headline">
        <h2 className="home-title">今日のダッシュボード</h2>
        <p className="home-date">{metrics.todayLabel}</p>
      </section>

      <section className="card home-insight-card">
        <h3 className="home-card-title">AI 一言アドバイス</h3>
        <p className="home-insight-text">{metrics.insight}</p>
      </section>

      <section className="card">
        <h3 className="home-card-title">今日のアクティビティ</h3>
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
