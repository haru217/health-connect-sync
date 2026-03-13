import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCustomReportById, fetchWeeklyReportByWeekStart } from '../api/reports'
import type { WeeklyReportItem } from '../api/types'

interface ReportDetailScreenProps {
  readonly reportId?: number | null
  readonly weeklyReportWeekStart?: string | null
  readonly onBack: () => void
}

function renderMarkdownText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2)
      return (
        <strong key={index} style={{ fontWeight: 'bold' }}>
          {content}
        </strong>
      )
    }
    return <span key={index}>{part}</span>
  })
}

function stripMarkdownHeadings(line: string): string {
  return line.replace(/^#{1,6}\s+/, '')
}

function renderReportBody(text: string) {
  const paragraphs = text.split(/\n\n+/).map(p => stripMarkdownHeadings(p.trim())).filter(p => p.length > 0)
  return (
    <div style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
      {paragraphs.map((para, i) => {
        const sectionMatch = para.match(/^【(.+?)】([\s\S]*)/)
        if (sectionMatch) {
          const sectionLines = sectionMatch[2].trim().split(/\n/).map(l => stripMarkdownHeadings(l.trim())).filter(l => l.length > 0)
          return (
            <div key={i} style={{ marginBottom: i < paragraphs.length - 1 ? '16px' : 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'var(--accent-color)',
                marginBottom: '6px',
              }}>
                {sectionMatch[1]}
              </div>
              {sectionLines.map((line, j) => (
                <p key={j} style={{ margin: `0 0 ${j < sectionLines.length - 1 ? '4px' : '0'} 0` }}>
                  {renderMarkdownText(line)}
                </p>
              ))}
            </div>
          )
        }
        return (
          <p key={i} style={{ margin: `0 0 ${i < paragraphs.length - 1 ? '12px' : '0'} 0` }}>
            {renderMarkdownText(para)}
          </p>
        )
      })}
    </div>
  )
}

type FetchState =
  | { status: 'loading' }
  | { status: 'success'; text: string; title: string }
  | { status: 'error'; message: string }

export default function ReportDetailScreen({ reportId, weeklyReportWeekStart, onBack }: ReportDetailScreenProps) {
  const [state, setState] = useState<FetchState>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    if (weeklyReportWeekStart) {
      fetchWeeklyReportByWeekStart(weeklyReportWeekStart)
        .then((row: WeeklyReportItem) => {
          if (alive) {
            setState({
              status: 'success',
              text: row.report,
              title: `週次レポート: ${row.week_start}〜${row.week_end}`,
            })
          }
        })
        .catch((err) => {
          if (alive) setState({ status: 'error', message: err instanceof Error ? err.message : 'レポートを読み込めませんでした' })
        })
      return () => { alive = false }
    }

    if (reportId == null) {
      setState({ status: 'error', message: 'レポートの指定がありません' })
      return () => { alive = false }
    }

    fetchCustomReportById(reportId)
      .then((text) => {
        if (alive) {
          setState({ status: 'success', text, title: 'レポート詳細' })
        }
      })
      .catch((err) => {
        if (alive) setState({ status: 'error', message: err instanceof Error ? err.message : 'レポートを読み込めませんでした' })
      })

    return () => { alive = false }
  }, [reportId, weeklyReportWeekStart])

  const headerTitle = state.status === 'success'
    ? state.title
    : weeklyReportWeekStart
      ? `週次レポート: ${weeklyReportWeekStart}`
      : 'レポート詳細'

  return (
    <div style={{ padding: '0 16px 32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 0',
        marginBottom: '8px',
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--surface)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="戻る"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>arrow_back</span>
        </button>
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{headerTitle}</span>
      </div>

      {/* Body */}
      {state.status === 'loading' ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : null}

      {state.status === 'error' ? (
        <div style={{ padding: '16px', background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger-color, #dc2626)', borderRadius: '12px', fontSize: '13px' }}>
          {state.message}
        </div>
      ) : null}

      {state.status === 'success' ? (
        <div style={{
          background: 'var(--surface)',
          borderRadius: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          {/* アバター領域 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '20px 20px 16px 20px',
            background: 'linear-gradient(to bottom, var(--surface-subtle), var(--surface))',
            borderBottom: '1px solid rgba(0,0,0,0.02)'
          }}>
            <div style={{
              flexShrink: 0, width: '64px', height: '64px', borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid white',
              boxShadow: '0 4px 12px rgba(45,139,111,0.15)',
              background: 'white',
            }}>
              <img
                src="/haru-avatar.png"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>

          {/* レポート本文 */}
          <div style={{ padding: '0 20px 24px 20px' }}>
            {renderReportBody(state.text)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
