import { useEffect, useState } from 'react'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchProfile, fetchSummary } from '../api/healthApi'
import type { ProfileResponse, RequestState, SummaryResponse } from '../api/types'
import './HealthScreen.css'

type TabType = 'diet' | 'vital'

interface HealthData {
  summary: SummaryResponse
  profile: ProfileResponse
}

function latestValue<T>(series: T[], valueSelector: (item: T) => number): number | null {
  const latest = series[series.length - 1]
  if (!latest) {
    return null
  }
  const value = valueSelector(latest)
  return Number.isFinite(value) ? value : null
}

function trendMessage(summary: SummaryResponse): string {
  const trend = summary.diet?.trend
  if (!trend) {
    return summary.insights[0]?.message ?? 'データ同期後にトレンドが表示されます。'
  }
  const trendMap: Record<string, string> = {
    gain: '体重は増加傾向です。摂取と消費のバランスを見直しましょう。',
    plateau: '体重は停滞気味です。運動量や食事内容を微調整するタイミングです。',
    slow_loss: 'ゆるやかな減量傾向です。現在のペースを維持しましょう。',
    loss: '減量が順調に進んでいます。このまま継続しましょう。',
    unknown: '体重データがまだ少ないため、トレンド評価は保留です。',
  }
  return trendMap[trend] ?? summary.insights[0]?.message ?? 'トレンド評価を準備中です。'
}

function toDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })
}

export default function HealthScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('diet')
  const [state, setState] = useState<RequestState<HealthData>>({ status: 'loading' })

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
  const goalWeight = profile.goal_weight_kg ?? null
  const currentWeight = latestValue(summary.weightByDate, (item) => item.kg)
  const remainingWeight = goalWeight != null && currentWeight != null ? goalWeight - currentWeight : null

  const weightChartData = summary.weightByDate.slice(-30).map((item) => ({
    date: toDateLabel(item.date),
    weight: item.kg,
    target: goalWeight,
  }))

  const heartSeries = summary.restingHeartRateBpmByDate.length
    ? summary.restingHeartRateBpmByDate
    : summary.heartRateBpmByDate

  const heartChartData = heartSeries.slice(-14).map((item) => ({
    date: toDateLabel(item.date),
    hr: item.bpm,
  }))

  const latestRestingHeartRate = latestValue(heartSeries, (item) => item.bpm)
  const latestSleep = latestValue(summary.sleepHoursByDate, (item) => item.hours)
  const latestSpo2 = latestValue(summary.oxygenSaturationPctByDate, (item) => item.pct)

  return (
    <>
      <div className="health-container fade-in">
        <div className="tab-row">
          <div className={`tab-btn ripple ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>
            ダイエット
          </div>
          <div className={`tab-btn ripple ${activeTab === 'vital' ? 'active' : ''}`} onClick={() => setActiveTab('vital')}>
            バイタル
          </div>
        </div>

        <div className="tab-content fade-in">
          {activeTab === 'diet' && (
            <div className="diet-section">
              <div className="summary-grid">
                <div className="summary-card card ripple stagger-1">
                  <div className="summary-label">現在</div>
                  <div className="summary-value num">
                    {currentWeight == null ? '--' : currentWeight.toFixed(1)} <span className="unit">kg</span>
                  </div>
                </div>
                <div className="summary-card card ripple stagger-2">
                  <div className="summary-label">目標</div>
                  <div className="summary-value num">
                    {goalWeight == null ? '--' : goalWeight.toFixed(1)} <span className="unit">kg</span>
                  </div>
                </div>
                <div className="summary-card card ripple stagger-3">
                  <div className="summary-label">残り</div>
                  <div className="summary-value num good">
                    {remainingWeight == null ? '--' : remainingWeight.toFixed(1)} <span className="unit">kg</span>
                  </div>
                </div>
              </div>

              <div className="trend-text card stagger-4">
                <span className="trend-icon">✨</span>
                <p>{trendMessage(summary)}</p>
              </div>

              <div className="chart-card card stagger-5">
                <div className="chart-header">体重推移（30日）</div>
                <div className="rechart-container" style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        name="体重"
                        stroke="var(--accent-color)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                      {goalWeight != null && (
                        <Line
                          type="monotone"
                          dataKey="target"
                          name="目標"
                          stroke="var(--text-muted)"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vital' && (
            <div className="vital-section fade-in">
              <div className="vital-grid">
                <div className="vital-card card ripple stagger-1">
                  <div className="vital-header">
                    <span className="vital-icon">❤️</span> 安静時心拍
                  </div>
                  <div className="vital-value num">
                    {latestRestingHeartRate == null ? '--' : Math.round(latestRestingHeartRate)} <span className="unit">bpm</span>
                  </div>
                </div>

                <div className="vital-card card ripple stagger-2">
                  <div className="vital-header">
                    <span className="vital-icon">🩸</span> 血圧
                  </div>
                  <div className="vital-value num">
                    --<span className="unit">/</span>-- <span className="unit">mmHg</span>
                  </div>
                </div>

                <div className="vital-card card ripple stagger-3">
                  <div className="vital-header">
                    <span className="vital-icon">💨</span> SpO2
                  </div>
                  <div className="vital-value num">
                    {latestSpo2 == null ? '--' : latestSpo2.toFixed(1)} <span className="unit">%</span>
                  </div>
                </div>

                <div className="vital-card card ripple stagger-4">
                  <div className="vital-header">
                    <span className="vital-icon">🌙</span> 睡眠
                  </div>
                  <div className="vital-value num">
                    {latestSleep == null ? '--' : latestSleep.toFixed(1)} <span className="unit">h</span>
                  </div>
                </div>
              </div>

              <div className="chart-card card stagger-5">
                <div className="chart-header">安静時心拍（14日）</div>
                <div className="rechart-container" style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={heartChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Line
                        type="monotone"
                        dataKey="hr"
                        name="心拍"
                        stroke="var(--danger-color)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2, stroke: 'var(--danger-color)' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {activeTab === 'diet' && <button className="fab ripple" aria-label="体重データを追加">＋</button>}
      {activeTab === 'vital' && <button className="fab ripple" aria-label="バイタルデータを追加">＋</button>}
    </>
  )
}
