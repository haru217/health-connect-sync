import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchHomeSummary, fetchScores, fetchSummary, generateDailyReport } from '../api/healthApi'
import { fetchCustomReportsHistory, fetchMonthlyReports, fetchWeeklyReports, requestCustomReport } from '../api/reports'
import type {
  HomeSummaryResponse,
  RequestState,
  ScoreData,
  ScoreDomain,
  SummaryResponse,
  CustomReportHistoryItem,
  MonthlyReportItem,
  WeeklyReportItem,
} from '../api/types'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import HaruBriefing from '../components/HaruBriefing'
import ScoreCircle from '../components/ScoreCircle'
import Toast from '../components/Toast'
import './HomeScreen.css'

export type HomeNavigateTarget = {
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: 'composition' | 'vital' | 'sleep' | 'circulation'
}

type DomainKey = 'sleep' | 'activity' | 'nutrition' | 'condition'

const DOMAIN_CONFIG: ReadonlyArray<{
  key: DomainKey
  label: string
  icon: ReactNode
  colorVar: string
  navigateTo: HomeNavigateTarget
}> = [
    {
      key: 'sleep',
      label: '睡眠',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
      colorVar: 'var(--accent-yellow)',
      navigateTo: { tab: 'health', innerTab: 'sleep' },
    },
    {
      key: 'activity',
      label: 'アクティビティ',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      colorVar: 'var(--accent-blue)',
      navigateTo: { tab: 'exercise' },
    },
    {
      key: 'nutrition',
      label: '食事',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        </svg>
      ),
      colorVar: 'var(--accent-color)',
      navigateTo: { tab: 'meal' },
    },
    {
      key: 'condition',
      label: 'からだ',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
      colorVar: 'var(--accent-red)',
      navigateTo: { tab: 'health', innerTab: 'circulation' },
    },
  ]

function EmptyState() {
  return (
    <div className="home-empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>データが少ない日です</div>
      <div style={{ fontSize: '13px', marginTop: '6px' }}>スマートフォンからデータを同期してください</div>
    </div>
  )
}

function computeDiff(scores: ScoreData): number | null {
  const baselineValues = Object.values(scores.baseline ?? {}).filter(
    (v): v is number => v != null,
  )
  if (baselineValues.length === 0) return null
  const avg = Math.round(baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length)
  if (!scores.overall) return null
  return scores.overall.score - avg
}

function bestDomainSummary(scores: ScoreData): string | null {
  const domains = scores.domains
  let best: ScoreDomain | null = null
  for (const d of Object.values(domains)) {
    if (d && (!best || d.score > best.score)) {
      best = d
    }
  }
  return best?.summary ?? null
}

// ----------------------------------------------------------------------------
// H4 MVP Components
// ----------------------------------------------------------------------------

function computeAveragesFallback(full: SummaryResponse): Record<string, number | null> {
  const avg = (arr: any[], key: string) => {
    const valid = arr.map(x => x[key]).filter(x => typeof x === 'number' && x > 0)
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  }
  return {
    steps: avg(full.stepsByDate || [], 'steps'),
    sleep: avg(full.sleepHoursByDate || [], 'hours') ? avg(full.sleepHoursByDate || [], 'hours')! * 60 : null,
    weight: avg(full.weightByDate || [], 'kg'),
  }
}



const TEMPLATES = [
  { id: 'weight', icon: 'monitor_weight', label: '体重の変化', desc: '体重推移を分析' },
  { id: 'sleep', icon: 'bedtime', label: '睡眠の質', desc: 'パターンを分析' },
  { id: 'blood_pressure', icon: 'favorite', label: '血圧の傾向', desc: '傾向を分析' },
  { id: 'activity', icon: 'directions_run', label: '運動量', desc: '活動量を分析' },
  { id: 'nutrition', icon: 'restaurant', label: '食事バランス', desc: '栄養を分析' },
  { id: 'general', icon: 'health_and_safety', label: '全体の健康', desc: '総合分析' },
] as const

function CustomReportSection({
  history,
  onRequest,
  onViewReport,
  onViewHistory,
}: {
  history: CustomReportHistoryItem[]
  onRequest: (id: string) => void
  onViewReport?: (id: number) => void
  onViewHistory?: () => void
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const recentCustomReports = history.slice(0, 3)

  const styles = `
    .haru-template-btn {
      position: relative;
      overflow: hidden;
      padding: 16px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--border-color);
      text-align: left;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      display: flex;
      flex-direction: column;
    }
    .haru-template-btn::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .haru-template-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0,0,0,0.06);
      border-color: var(--accent-color);
    }
    .haru-template-btn:hover::before {
      opacity: 1;
    }
    .haru-template-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .haru-template-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--surface-subtle, rgba(0,0,0,0.03));
      color: var(--accent-color);
      margin-bottom: 12px;
      transition: all 0.3s ease;
    }
    .haru-template-btn:hover .haru-template-icon-wrap {
      background: var(--accent-color);
      color: white;
      transform: scale(1.05);
    }
  `

  const handleClick = async (id: string) => {
    setLoadingId(id)
    try {
      await onRequest(id)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section className="custom-report-section" style={{ margin: '32px 16px' }}>
      <style>{styles}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--accent-color)', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>psychology</span>
        <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>もっと詳しく</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            disabled={loadingId === t.id}
            onClick={() => handleClick(t.id)}
            className="haru-template-btn"
            style={{
              opacity: loadingId === t.id ? 0.7 : 1
            }}>
            <div className="haru-template-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
                {t.icon}
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {loadingId === t.id ? '生成中...' : t.label}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{t.desc}</div>
          </button>
        ))}
      </div>
      {recentCustomReports.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {recentCustomReports.map((report) => (
            <div
              key={report.id}
              role="button"
              tabIndex={0}
              onClick={() => onViewReport?.(report.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onViewReport?.(report.id)
                }
              }}
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                  {report.templateLabel}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {new Date(report.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <button hidden
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onViewHistory?.()
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent-color)',
                    marginTop: '8px',
                    textAlign: 'right',
                    cursor: 'pointer',
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                  }}
                >
                  履歴を見る
                </button>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)', flexShrink: 0 }}>
                chevron_right
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

// ----------------------------------------------------------------------------

function WeeklyReportCard({
  report,
  onOpen,
  onViewHistory,
}: {
  report: WeeklyReportItem | null
  onOpen?: (weekStart: string) => void
  onViewHistory?: () => void
}) {
  return (
    <section style={{ margin: '0 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--accent-indigo)', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
          calendar_month
        </span>
        <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>週次レポート</h3>
      </div>
      {report ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen?.(report.week_start)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen?.(report.week_start)
            }
          }}
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '14px 16px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {report.week_start}〜{report.week_end}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                {report.headline}
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)', flexShrink: 0 }}>
              chevron_right
            </span>
          </div>
          <button hidden
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onViewHistory?.()
            }}
            onKeyDown={(event) => event.stopPropagation()}
            style={{
              fontSize: '12px',
              color: 'var(--accent-color)',
              marginTop: '8px',
              textAlign: 'right',
              cursor: 'pointer',
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            履歴を見る
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div>週次レポートはまだありません</div>
          <button hidden
            type="button"
            onClick={onViewHistory}
            style={{
              fontSize: '12px',
              color: 'var(--accent-color)',
              marginTop: '8px',
              textAlign: 'right',
              cursor: 'pointer',
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            履歴を見る
          </button>
        </div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------------------

function MonthlyReportCard({
  report,
  onOpen,
  onViewHistory,
}: {
  report: MonthlyReportItem | null
  onOpen?: (month: string) => void
  onViewHistory?: () => void
}) {
  const monthLabel = report
    ? (() => {
      const [y, m] = report.month.split('-').map(Number)
      return `${y}年${m}月`
    })()
    : null

  return (
    <section style={{ margin: '0 16px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--accent-indigo)', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
          date_range
        </span>
        <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>月次レポート</h3>
      </div>
      {report ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen?.(report.month)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen?.(report.month)
            }
          }}
          style={{
            background: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '14px 16px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {monthLabel}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                {report.headline}
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)', flexShrink: 0 }}>
              chevron_right
            </span>
          </div>
          <button hidden
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onViewHistory?.()
            }}
            onKeyDown={(event) => event.stopPropagation()}
            style={{
              fontSize: '12px',
              color: 'var(--accent-color)',
              marginTop: '8px',
              textAlign: 'right',
              cursor: 'pointer',
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            履歴を見る
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div>月次レポートはまだありません</div>
          <button hidden
            type="button"
            onClick={onViewHistory}
            style={{
              fontSize: '12px',
              color: 'var(--accent-color)',
              marginTop: '8px',
              textAlign: 'right',
              cursor: 'pointer',
              width: '100%',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            履歴を見る
          </button>
        </div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------------------

type HomeScreenData = {
  summary: HomeSummaryResponse
  scores: ScoreData
  fullSummary: SummaryResponse
  customReports: CustomReportHistoryItem[]
  latestWeeklyReport: WeeklyReportItem | null
  latestMonthlyReport: MonthlyReportItem | null
}

interface HomeScreenProps {
  onNavigate?: (target: HomeNavigateTarget) => void
  onViewReport?: (id: number) => void
  onViewHistory?: () => void
  onViewWeeklyReport?: (weekStart: string) => void
  onViewMonthlyReport?: (month: string) => void
}

export default function HomeScreen({
  onNavigate,
  onViewReport,
  onViewHistory,
  onViewWeeklyReport,
  onViewMonthlyReport,
}: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeScreenData>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    Promise.all([
      fetchHomeSummary(activeDate),
      fetchScores(activeDate),
      fetchSummary(),
      fetchCustomReportsHistory(),
      fetchWeeklyReports(1),
      fetchMonthlyReports(1),
    ])
      .then(([summaryRes, scoresRes, fullSummaryRes, reportsRes, weeklyReports, monthlyReports]) => {
        if (alive) {
          setState({
            status: 'success',
            data: {
              summary: summaryRes,
              scores: scoresRes,
              fullSummary: fullSummaryRes,
              customReports: reportsRes,
              latestWeeklyReport: weeklyReports[0] ?? null,
              latestMonthlyReport: monthlyReports[0] ?? null,
            },
          })
        }
      })
      .catch((error) => {
        if (alive) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : 'データを読み込めませんでした'
          })
        }
      })

    return () => {
      alive = false
    }
  }, [activeDate])

  const [reportError, setReportError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleRequestReport = useCallback(async (templateId: string) => {
    setReportError(null)
    try {
      await requestCustomReport(templateId)
      const reportsRes = await fetchCustomReportsHistory()
      setState(prev => {
        if (prev.status !== 'success') return prev
        return { ...prev, data: { ...prev.data, customReports: reportsRes } }
      })
    } catch {
      setReportError('レポートの生成に失敗しました')
    }
  }, [])

  const handleGenerateBriefing = useCallback(async () => {
    setGenerating(true)
    try {
      await generateDailyReport(activeDate)
      const summaryRes = await fetchHomeSummary(activeDate)
      setState((prev) => {
        if (prev.status !== 'success') return prev
        return { ...prev, data: { ...prev.data, summary: summaryRes } }
      })
    } catch {
      setToastMessage('ブリーフィングの生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }, [activeDate])

  const content = useMemo(() => {
    if (state.status !== 'success') return null

    const { summary, scores, fullSummary, customReports, latestWeeklyReport, latestMonthlyReport } = state.data
    const sufficiency = summary.sufficiency
    const hasSomeData = Boolean(sufficiency.sleep || sufficiency.steps || sufficiency.weight || sufficiency.meal || sufficiency.bp)
    const diff = computeDiff(scores)
    const heroDesc = bestDomainSummary(scores)

    const averages = summary.averages && Object.keys(summary.averages).length > 0
      ? summary.averages
      : computeAveragesFallback(fullSummary)

    return {
      summary,
      scores,
      hasSomeData,
      diff,
      heroDesc,
      averages,
      customReports,
      latestWeeklyReport,
      latestMonthlyReport,
    }
  }, [state])

  return (
    <div className="home-container">
      <DateNavBar />

      {state.status === 'loading' ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : null}

      {state.status === 'error' ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>{state.error}</div>
      ) : null}

      {content ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', margin: '16px 16px 32px 16px' }}>
            <div style={{
              position: 'relative',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid white',
              boxShadow: '0 4px 12px rgba(45,139,111,0.12)',
              background: 'white',
              flexShrink: 0,
              marginRight: '12px',
              marginTop: '10px',
            }}>
              <img
                src="/haru-avatar.png"
                alt="はるクロード"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#4CAF50',
                border: '2px solid white',
              }} />
            </div>
            <HaruBriefing
              briefing={content.summary.report?.briefing}
              activeDate={activeDate}
              onGenerate={handleGenerateBriefing}
              generating={generating}
            />
          </div>
          <WeeklyReportCard
            report={content.latestWeeklyReport}
            onOpen={onViewWeeklyReport}
          />
          <MonthlyReportCard
            report={content.latestMonthlyReport}
            onOpen={onViewMonthlyReport}
          />
          <CustomReportSection
            history={content.customReports}
            onRequest={handleRequestReport}
            onViewReport={onViewReport}
          />
          {reportError && (
            <div style={{ margin: '0 16px', padding: '12px', background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger-color, #dc2626)', borderRadius: '8px', fontSize: '13px' }}>
              {reportError}
            </div>
          )}

          {onViewHistory ? (
            <button
              type="button"
              onClick={onViewHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: 'calc(100% - 32px)',
                margin: '8px 16px 0',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--surface)',
                fontSize: '13px',
                color: 'var(--accent-color)',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
              履歴を見る
            </button>
          ) : null}

          {false && content ? (
            <>
              {/* Hero Score */}
              <section className="home-hero-score">
                <div className="hero-decor-circle" />
                <div className="hero-score-content">
                  <div className="hero-score-title">今日の総合スコア</div>
                  <div className="hero-score-value-row">
                    <span className="hero-score-number num">{content!.scores.overall?.score ?? '-'}</span>
                    {content!.diff != null && content!.diff !== 0 ? (
                      <span className={`hero-score-badge ${content!.diff! < 0 ? 'negative' : ''}`}>
                        前日比 {content!.diff! > 0 ? '+' : ''}{content!.diff}
                      </span>
                    ) : null}
                  </div>
                  {content!.heroDesc ? (
                    <p className="hero-score-desc">{content!.heroDesc}</p>
                  ) : null}
                </div>
                <div className="hero-score-chart">
                  {content!.scores.overall ? (
                    <ScoreCircle
                      score={content!.scores.overall.score}
                      color={content!.scores.overall.color}
                      size="hero"
                      showValue={false}
                      icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>N/A</div>
                  )}
                </div>
              </section>

              {/* Domain Cards 2x2 */}
              <section className="home-domain-scores">
                {DOMAIN_CONFIG.map((cfg) => {
                  const domain = content!.scores.domains[cfg.key]
                  const valueLabel = cfg.key === 'condition'
                    ? (domain ? (domain.color === 'green' ? '良好' : domain.color === 'yellow' ? '注意' : '要注意') : '--')
                    : (domain?.values?.label ?? '--')

                  return (
                    <div
                      key={cfg.key}
                      className={`domain-card ${!domain ? 'no-data' : ''}`}
                      onClick={() => onNavigate?.(cfg.navigateTo)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onNavigate?.(cfg.navigateTo)
                      }}
                    >
                      <div className="domain-card-header">
                        <span className="domain-icon" style={{ color: cfg.colorVar }}>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                        <span className="domain-card-chevron">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </div>
                      <div className="domain-card-body">
                        <div className="domain-value">
                          <span className="domain-value-num num">{valueLabel}</span>
                        </div>
                        {domain ? (
                          <ScoreCircle score={domain.score} color={domain.color} size="small" />
                        ) : (
                          <div className="domain-donut-placeholder" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>

              {!content!.hasSomeData ? <EmptyState /> : null}
            </>
          ) : null}
        </>
      ) : null}
      {toastMessage ? (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </div>
  )
}
