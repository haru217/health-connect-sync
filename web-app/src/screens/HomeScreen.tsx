import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchHomeSummary } from '../api/healthApi'
import type {
  AttentionPoint,
  HomeStatusItem,
  HomeSummaryResponse,
  RequestState,
} from '../api/types'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import './HomeScreen.css'

export type HomeNavigateTarget = {
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: 'composition' | 'vital' | 'sleep'
}

interface HomeScreenProps {
  onNavigate?: (target: HomeNavigateTarget) => void
}

const ATTENTION_ICONS: Record<string, ReactNode> = {
  warning: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  down: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>,
  up: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
}

type StatusMeta = {
  label: string
  icon: ReactNode
}

const STATUS_META: Record<HomeStatusItem['key'], StatusMeta> = {
  sleep: {
    label: '睡眠',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
  activity: {
    label: '活動',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  nutrition: {
    label: '栄養',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
      </svg>
    ),
  },
  condition: {
    label: 'コンディション',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
}

type ExpertTag = 'DOCTOR' | 'TRAINER' | 'NUTRITIONIST'

function markerRegex(): RegExp {
  return /<!--\s*(\/?\s*(?:DOCTOR|TRAINER|NUTRITIONIST)|END)\s*-->/gi
}

function extractAgentSections(content: string): {
  doctor: string | null
  trainer: string | null
  nutritionist: string | null
} {
  const byTag: Record<ExpertTag, string[]> = {
    DOCTOR: [],
    TRAINER: [],
    NUTRITIONIST: [],
  }

  let currentTag: ExpertTag | null = null
  let cursor = 0
  const matcher = markerRegex()
  let matched = matcher.exec(content)

  while (matched) {
    const start = matched.index
    const rawToken = (matched[1] ?? '').replace(/\s+/g, '').toUpperCase()
    const slice = content.slice(cursor, start).trim()
    if (currentTag && slice) {
      byTag[currentTag].push(slice)
    }

    if (rawToken === 'END') {
      currentTag = null
    } else if (rawToken.startsWith('/')) {
      const closing = rawToken.slice(1) as ExpertTag
      if (currentTag === closing) {
        currentTag = null
      }
    } else if (rawToken === 'DOCTOR' || rawToken === 'TRAINER' || rawToken === 'NUTRITIONIST') {
      currentTag = rawToken
    }

    cursor = matcher.lastIndex
    matched = matcher.exec(content)
  }

  const tail = content.slice(cursor).trim()
  if (currentTag && tail) {
    byTag[currentTag].push(tail)
  }

  const normalize = (parts: string[]): string | null => {
    if (parts.length === 0) {
      return null
    }
    const merged = parts.join('\n').trim()
    return merged.length > 0 ? merged : null
  }

  return {
    doctor: normalize(byTag.DOCTOR),
    trainer: normalize(byTag.TRAINER),
    nutritionist: normalize(byTag.NUTRITIONIST),
  }
}

function stripTags(raw: string): string {
  return raw
    .replace(markerRegex(), '')
    .replace(/\s+/g, ' ')
    .trim()
}

function summaryLine(content: string): string {
  const sections = extractAgentSections(content)
  const source = sections.doctor ?? sections.trainer ?? sections.nutritionist ?? content
  const plain = stripTags(source)
  if (plain.length <= 96) {
    return plain
  }
  return `${plain.slice(0, 96)}...`
}

function AiCard({ title, icon, content, defaultOpen = false }: { title: string; icon: ReactNode; content: string; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="ai-advisor-card">
      <button type="button" className="ai-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="ai-card-title">
          <div className="ai-icon-container">{icon}</div>
          {title}
        </div>
        <div className={`ai-card-chevron ${isOpen ? 'open' : ''}`}>›</div>
      </button>
      {isOpen ? <div className="ai-card-body">{content}</div> : null}
    </div>
  )
}

function ExpertSection({ content }: { content: string }) {
  const sections = extractAgentSections(content)

  const doctorIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
  const trainerIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" /></svg>
  const nutritionIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>

  const hasAny = Boolean(sections.doctor || sections.trainer || sections.nutritionist)
  if (!hasAny) {
    return (
      <section className="ai-advisor-section">
        <div className="home-section-title">3人の専門家から</div>
        <AiCard title="医師" icon={doctorIcon} content={stripTags(content)} defaultOpen={true} />
      </section>
    )
  }

  return (
    <section className="ai-advisor-section">
      <div className="home-section-title">3人の専門家から</div>
      {sections.trainer ? <AiCard title="トレーナー" icon={trainerIcon} content={sections.trainer} defaultOpen={true} /> : null}
      {sections.doctor ? <AiCard title="医師" icon={doctorIcon} content={sections.doctor} /> : null}
      {sections.nutritionist ? <AiCard title="管理栄養士" icon={nutritionIcon} content={sections.nutritionist} /> : null}
    </section>
  )
}

function StatusBar({
  items,
  onNavigate,
}: {
  items: HomeStatusItem[]
  onNavigate?: (target: HomeNavigateTarget) => void
}) {
  return (
    <section className="home-status-section">
      <div className="home-status-grid" role="list">
        {items.map((item) => {
          const meta = STATUS_META[item.key]
          const progress = item.progress ?? (item.ok ? 100 : 0)

          const radius = 14
          const circ = 2 * Math.PI * radius
          const offset = circ - (progress / 100) * circ
          const isWarning = item.tone === 'warning'
          const isCritical = item.tone === 'critical'

          let trailColor = 'rgba(136, 212, 180, 0.2)'
          let pathColor = 'var(--accent-color)'
          let pillToneClass = ''

          if (isCritical) {
            trailColor = 'rgba(239, 154, 154, 0.3)'
            pathColor = '#EF5350' // Red
            pillToneClass = 'critical'
          } else if (isWarning) {
            trailColor = 'rgba(255, 204, 128, 0.3)'
            pathColor = '#FFB74D' // Orange/Yellow
            pillToneClass = 'warning'
          }

          return (
            <button
              key={item.key}
              type="button"
              className={`status-pill ${item.ok ? 'ok' : 'ng'} ${pillToneClass}`}
              onClick={() => onNavigate?.({ tab: item.tab, innerTab: item.innerTab })}
            >
              <div className="status-progress-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" className="spi-ring">
                  <circle cx="16" cy="16" r={radius} fill="none" stroke={trailColor} strokeWidth="3" />
                  <circle cx="16" cy="16" r={radius} fill="none" stroke={pathColor} strokeWidth="3"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 16 16)" />
                </svg>
                <div className="spi-icon">{meta.icon}</div>
              </div>
              <div className="status-text-stack">
                <span className="status-label">{meta.label}</span>
                <span className="status-value">{item.value ?? '-'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function AttentionSection({
  points,
  onNavigate,
}: {
  points: AttentionPoint[]
  onNavigate?: (target: HomeNavigateTarget) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? points : points.slice(0, 5)
  const remaining = points.length - visible.length

  return (
    <section className="attention-section">
      <div className="home-section-title">注目ポイント</div>
      {points.length === 0 ? (
        <div className="attention-empty">
          <span className="attention-icon" style={{ color: '#5ca67b' }}>{ATTENTION_ICONS.check}</span>
          <span>特に注目点なし。順調です</span>
        </div>
      ) : (
        <>
          <div className="attention-list">
            {visible.map((point) => (
              <button
                key={point.id}
                type="button"
                className={`attention-item ${point.severity}`}
                onClick={() => onNavigate?.({ tab: point.navigateTo.tab, innerTab: point.navigateTo.subTab })}
              >
                <span className="attention-icon">{ATTENTION_ICONS[point.icon] || ATTENTION_ICONS.alert}</span>
                <span className="attention-message">{point.message}</span>
                <span className="attention-arrow">›</span>
              </button>
            ))}
          </div>
          {remaining > 0 ? (
            <button type="button" className="attention-more" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? '折りたたむ' : `他${remaining}件`}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}

function NoReportCard({
  previousReport,
  onNavigate,
}: {
  previousReport?: HomeSummaryResponse['previousReport']
  onNavigate?: (target: HomeNavigateTarget) => void
}) {
  return (
    <section className="home-no-report-card">
      <div className="home-section-title">今日のまとめ</div>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>レポート未生成です</div>
      {previousReport ? (
        <button type="button" className="home-report-link" onClick={() => onNavigate?.({ tab: 'my' })}>
          前回のレポート（{previousReport.date}）を見る
        </button>
      ) : (
        <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>前回レポートはまだありません</div>
      )}
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

function fallbackStatusItems(data: HomeSummaryResponse): HomeStatusItem[] {
  if (data.statusItems && data.statusItems.length > 0) {
    return data.statusItems
  }
  const sufficiency = data.sufficiency
  const items: HomeStatusItem[] = [
    { key: 'sleep', label: '睡眠', value: null, ok: Boolean(sufficiency.sleep), tab: 'health', innerTab: 'sleep', tone: 'normal' },
    { key: 'activity', label: '活動', value: null, ok: Boolean(sufficiency.steps), tab: 'exercise', tone: 'normal' },
    { key: 'nutrition', label: '栄養', value: null, ok: Boolean(sufficiency.meal), tab: 'meal', tone: 'normal' },
    {
      key: 'condition',
      label: 'コンディション',
      value: null,
      ok: Boolean(sufficiency.weight || sufficiency.bp),
      tab: 'health',
      innerTab: sufficiency.bp ? 'vital' : 'composition',
      tone: 'normal',
    },
  ]
  return items
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeSummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    fetchHomeSummary(activeDate)
      .then((res) => {
        if (alive) {
          setState({ status: 'success', data: res })
        }
      })
      .catch((error) => {
        console.error(error)
        if (alive) {
          setState({
            status: 'success',
            data: {
              date: activeDate,
              report: null,
              sufficiency: { sleep: false, steps: false, weight: false, meal: false },
              evidences: [],
              statusItems: [],
              attentionPoints: [],
              previousReport: null,
            },
          })
        }
      })

    return () => {
      alive = false
    }
  }, [activeDate])

  const content = useMemo(() => {
    if (state.status !== 'success') {
      return null
    }
    const data = state.data
    const statusItems = fallbackStatusItems(data)
    const attentionPoints = data.attentionPoints ?? []
    const hasSomeData = statusItems.some((item) => item.ok)
    const hasReport = data.report != null

    return {
      data,
      statusItems,
      attentionPoints,
      hasSomeData,
      hasReport,
    }
  }, [state])

  return (
    <div className="home-container">
      <DateNavBar />

      {state.status === 'loading' ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : null}

      {content ? (
        <>
          <StatusBar items={content.statusItems} onNavigate={onNavigate} />
          <AttentionSection points={content.attentionPoints} onNavigate={onNavigate} />

          {content.hasReport ? (
            <>
              <section className="home-summary-card">
                <div className="home-section-title">今日のまとめ</div>
                <p className="home-summary-text">{summaryLine(content.data.report!.content)}</p>
              </section>
              <ExpertSection content={content.data.report!.content} />
            </>
          ) : null}

          {!content.hasReport && content.hasSomeData ? (
            <NoReportCard previousReport={content.data.previousReport} onNavigate={onNavigate} />
          ) : null}

          {!content.hasSomeData ? <EmptyState /> : null}
        </>
      ) : null}
    </div>
  )
}
