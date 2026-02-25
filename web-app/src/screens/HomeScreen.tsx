import { useEffect, useState } from 'react'
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

function AiCard({ title, icon, content, defaultOpen = false }: { title: string, icon: string, content: string, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="ai-advisor-card">
      <div className="ai-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="ai-card-title">{icon} {title}</div>
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

  if (!sections.doctor && !sections.trainer && !sections.nutritionist) {
    return (
      <div className="ai-advisor-section">
        <AiCard title="医師" icon="🩺" content={content} defaultOpen={true} />
      </div>
    )
  }

  return (
    <div className="ai-advisor-section">
      {sections.doctor && <AiCard title="医師" icon="🩺" content={sections.doctor} defaultOpen={true} />}
      {sections.trainer && <AiCard title="トレーナー" icon="💪" content={sections.trainer} />}
      {sections.nutritionist && <AiCard title="栄養士" icon="🥗" content={sections.nutritionist} />}
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
  switch (type) {
    case 'sleep': return '😴'
    case 'steps': return '👟'
    case 'weight': return '⚖️'
    case 'meal': return '🍽️'
    default: return '📊'
  }
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
      <div className="evidence-section-title">📊 根拠データ</div>
      <div className="evidence-list">
        {evidences.map((evidence, idx) => (
          <div
            key={idx}
            className="evidence-item"
            onClick={() => onNavigate && onNavigate(evidence.tab)}
          >
            <div className="evidence-icon">{getEvidenceIcon(evidence.type)}</div>
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
