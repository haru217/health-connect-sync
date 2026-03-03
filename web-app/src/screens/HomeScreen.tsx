import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchHomeSummary, fetchScores } from '../api/healthApi'
import type {
  HomeSummaryResponse,
  RequestState,
  ScoreData,
  ScoreDomain,
} from '../api/types'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import ExpertCard, { EXPERT_CONFIG, type ExpertTag } from '../components/ExpertCard'
import ScoreCircle from '../components/ScoreCircle'
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

interface HomeReport {
  yu: string | null
  saki: string | null
  mai: string | null
}

function ExpertSection({ home }: { home: HomeReport }) {
  const sectionMap: Record<ExpertTag, string | null> = {
    doctor: home.yu ?? null,
    nutritionist: home.saki ?? null,
    trainer: home.mai ?? null,
  }

  const hasAny = Boolean(home.yu || home.saki || home.mai)
  if (!hasAny) return null

  return (
    <section className="expert-section">
      <div className="expert-section-header">
        <div className="expert-section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>今日のひとこと</span>
        </div>
      </div>
      <div className="expert-cards-list">
        {EXPERT_CONFIG.map((cfg) => {
          const text = sectionMap[cfg.tag]
          if (!text) return null
          return <ExpertCard key={cfg.tag} {...cfg} content={text} />
        })}
      </div>
    </section>
  )
}

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

type HomeScreenData = {
  summary: HomeSummaryResponse
  scores: ScoreData
}

interface HomeScreenProps {
  onNavigate?: (target: HomeNavigateTarget) => void
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeScreenData>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    Promise.all([
      fetchHomeSummary(activeDate),
      fetchScores(activeDate)
    ])
      .then(([summaryRes, scoresRes]) => {
        if (alive) {
          setState({ status: 'success', data: { summary: summaryRes, scores: scoresRes } })
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

  const content = useMemo(() => {
    if (state.status !== 'success') return null

    const { summary, scores } = state.data
    const attentionPoints = summary.attentionPoints ?? []
    const sufficiency = summary.sufficiency
    const hasSomeData = Boolean(sufficiency.sleep || sufficiency.steps || sufficiency.weight || sufficiency.meal || sufficiency.bp)
    const hasReport = summary.report != null
    const diff = computeDiff(scores)
    const heroDesc = bestDomainSummary(scores)

    return {
      summary,
      scores,
      attentionPoints,
      hasSomeData,
      hasReport,
      diff,
      heroDesc,
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
          {/* Hero Score */}
          <section className="home-hero-score">
            <div className="hero-decor-circle" />
            <div className="hero-score-content">
              <div className="hero-score-title">今日の総合スコア</div>
              <div className="hero-score-value-row">
                <span className="hero-score-number num">{content.scores.overall?.score ?? '-'}</span>
                {content.diff != null && content.diff !== 0 ? (
                  <span className={`hero-score-badge ${content.diff < 0 ? 'negative' : ''}`}>
                    前日比 {content.diff > 0 ? '+' : ''}{content.diff}
                  </span>
                ) : null}
              </div>
              {content.heroDesc ? (
                <p className="hero-score-desc">{content.heroDesc}</p>
              ) : null}
            </div>
            <div className="hero-score-chart">
              {content.scores.overall ? (
                <ScoreCircle
                  score={content.scores.overall.score}
                  color={content.scores.overall.color}
                  size="hero"
                  showValue={false}
                  icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>N/A</div>
              )}
            </div>
          </section>

          {/* Attention Points — Stich order: hero → attention → domains */}
          {content.attentionPoints.length > 0 ? (
            <section className="home-insights-section">
              <div className="insight-card-teal">
                <div className="insight-icon-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="insight-text-content">
                  <div className="insight-header-row">
                    <span className="insight-heading">注目のポイント</span>
                  </div>
                  <p className="insight-text-body">
                    {content.attentionPoints.map((p) => p.message).join(' ')}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Domain Cards 2x2 */}
          <section className="home-domain-scores">
            {DOMAIN_CONFIG.map((cfg) => {
              const domain = content.scores.domains[cfg.key]
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

          {/* Expert Reports */}
          {content.hasReport ? (
            <ExpertSection home={content.summary.report!.home} />
          ) : null}

          {!content.hasSomeData ? <EmptyState /> : null}
        </>
      ) : null}
    </div>
  )
}
