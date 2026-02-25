import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchHomeSummary } from '../api/healthApi'
import type { RequestState, HomeSummaryResponse, HomeSufficiency, HomeEvidence } from '../api/types'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import './HomeScreen.css'

interface HomeScreenProps {
  onNavigate?: (tab: 'home' | 'health' | 'exercise' | 'meal' | 'my') => void
}

const ITEMS = [
  {
    key: 'sleep',
    label: '睡眠',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  },
  {
    key: 'steps',
    label: '歩数',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    )
  },
  {
    key: 'weight',
    label: '体重',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="3" ry="3" />
        <path d="M12 5v4" />
        <path d="M8 9h8" />
      </svg>
    )
  },
  {
    key: 'meal',
    label: '食事',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
      </svg>
    )
  },
] as const

function SufficiencyBar({ sufficiency }: { sufficiency: HomeSufficiency }) {
  return (
    <div className="home-sufficiency-bar">
      {ITEMS.map(item => {
        const isOn = sufficiency[item.key as keyof HomeSufficiency]
        return (
          <div
            key={item.key}
            className={`sufficiency-pill ${isOn ? 'on' : 'off'}`}
          >
            <div className="sufficiency-icon">
              {item.icon}
            </div>
            <span className="sufficiency-label">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function extractAgentSections(content: string): {
  doctor: string | null
  trainer: string | null
  nutritionist: string | null
} {
  const extract = (tag: string) => {
    const m = content.match(new RegExp(`<!--${tag}-->([\\s\\S]*?)<!--/${tag}-->`, 'i'))
    return m ? m[1].trim() : null
  }
  return {
    doctor: extract('DOCTOR'),
    trainer: extract('TRAINER'),
    nutritionist: extract('NUTRITIONIST'),
  }
}

function AiCard({ title, icon, content, defaultOpen = false }: { title: string, icon: ReactNode, content: string, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="ai-advisor-card">
      <div className="ai-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="ai-card-title">
          <div className="ai-icon-container">{icon}</div>
          {title}
        </div>
        <div className={`ai-card-chevron ${isOpen ? 'open' : ''}`}>›</div>
      </div>
      {isOpen && (
        <div className="ai-card-body">
          {content}
        </div>
      )}
    </div>
  )
}

function AiAdvisorSection({ content }: { content: string }) {
  const sections = extractAgentSections(content)

  const doctorIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" /><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" /><circle cx="20" cy="10" r="2" /></svg>
  const trainerIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" /></svg>
  const nutritionIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>

  if (!sections.doctor && !sections.trainer && !sections.nutritionist) {
    return (
      <div className="ai-advisor-section">
        <AiCard title="医師" icon={doctorIcon} content={content} defaultOpen={true} />
      </div>
    )
  }

  return (
    <div className="ai-advisor-section">
      {sections.doctor && <AiCard title="医師" icon={doctorIcon} content={sections.doctor} defaultOpen={true} />}
      {sections.trainer && <AiCard title="トレーナー" icon={trainerIcon} content={sections.trainer} />}
      {sections.nutritionist && <AiCard title="栄養士" icon={nutritionIcon} content={sections.nutritionist} />}
    </div>
  )
}

function NoReportCard() {
  return (
    <div className="home-no-report-card">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        <path d="M9 14h6"></path>
        <path d="M9 10h6"></path>
      </svg>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AIレポートはまだありません</div>
      <div style={{ fontSize: '13px', marginTop: '6px' }}>今日のデータが揃ったら<br />AIプロンプトでレポートを生成できます</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="home-empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>データがありません</div>
      <div style={{ fontSize: '13px', marginTop: '6px' }}>スマートフォンからデータを<br />同期してください</div>
    </div>
  )
}

function getEvidenceIcon(type: string) {
  const item = ITEMS.find(i => i.key === type)
  if (item) return item.icon
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function EvidenceList({
  evidences,
  onNavigate,
}: {
  evidences: HomeEvidence[]
  onNavigate?: (tab: HomeEvidence['tab']) => void
}) {
  return (
    <div className="evidence-section">
      <div className="evidence-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>根拠データ</span>
      </div>
      <div className="evidence-list">
        {evidences.map((evidence, idx) => (
          <div
            key={idx}
            className="evidence-item"
            onClick={() => onNavigate && onNavigate(evidence.tab)}
          >
            <div className="evidence-icon-wrap">{getEvidenceIcon(evidence.type)}</div>
            <div className="evidence-label">{evidence.label}</div>
            <div className="evidence-value">{evidence.value}</div>
            <div className="evidence-arrow">›</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { activeDate } = useDateContext()
  const [state, setState] = useState<RequestState<HomeSummaryResponse>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    fetchHomeSummary(activeDate)
      .then(res => {
        if (alive) setState({ status: 'success', data: res })
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
              evidences: []
            }
          })
        }
      })

    return () => {
      alive = false
    }
  }, [activeDate])

  return (
    <div className="home-container">
      <DateNavBar />

      {state.status === 'loading' && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
      )}

      {state.status === 'success' && (() => {
        const { data } = state
        const hasSomeData = Object.values(data.sufficiency).some(val => val)
        const hasReport = data.report != null

        return (
          <>
            <SufficiencyBar sufficiency={data.sufficiency} />

            {hasReport && <AiAdvisorSection content={data.report!.content} />}

            {!hasReport && hasSomeData && <NoReportCard />}

            {!hasSomeData && <EmptyState />}

            {data.evidences.length > 0 && (
              <EvidenceList evidences={data.evidences} onNavigate={onNavigate} />
            )}
          </>
        )
      })()}
    </div>
  )
}
