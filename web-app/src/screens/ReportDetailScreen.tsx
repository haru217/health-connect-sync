import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  fetchCustomReportById,
  fetchCustomReportsHistory,
  fetchMonthlyReportByMonth,
  fetchMonthlyReports,
  fetchWeeklyReportByWeekStart,
  fetchWeeklyReports,
} from '../api/reports'
import type {
  CustomReportHistoryItem,
  MonthlyReportItem,
  WeeklyReportItem,
} from '../api/types'

interface ReportDetailScreenProps {
  readonly reportId?: number | null
  readonly weeklyReportWeekStart?: string | null
  readonly monthlyReportMonth?: string | null
  readonly onBack: () => void
  readonly onViewHistory?: () => void
  readonly onViewWeeklyReport?: (weekStart: string) => void
  readonly onViewMonthlyReport?: (month: string) => void
  readonly onViewCustomReport?: (id: number) => void
}

type FetchState =
  | { status: 'loading' }
  | { status: 'success'; text: string; title: string }
  | { status: 'error'; message: string }

type ReportType = 'weekly' | 'monthly' | 'custom'

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

const sectionConfig: Record<string, { icon: string; color: string }> = {
  'からだ': { icon: 'favorite', color: 'var(--accent-red)' },
  '運動': { icon: 'directions_run', color: 'var(--accent-blue)' },
  '活動': { icon: 'directions_run', color: 'var(--accent-blue)' },
  '食事': { icon: 'restaurant', color: 'var(--accent-color)' },
  '栄養': { icon: 'restaurant', color: 'var(--accent-color)' },
  '睡眠': { icon: 'bedtime', color: 'var(--accent-yellow)' },
  'まとめ': { icon: 'psychology', color: 'var(--accent-indigo)' },
  '来週': { icon: 'event', color: 'var(--accent-indigo)' },
  '来月': { icon: 'event', color: 'var(--accent-indigo)' },
  '今週': { icon: 'trending_up', color: 'var(--accent-blue)' },
  '今月': { icon: 'trending_up', color: 'var(--accent-blue)' },
}

function findSectionConfig(title: string): { icon: string; color: string } {
  const entry = Object.entries(sectionConfig).find(
    ([key]) => title.startsWith(key),
  )
  return entry ? entry[1] : { icon: 'info', color: 'var(--text-muted)' }
}

function renderReportBody(text: string) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) => stripMarkdownHeadings(paragraph.trim()))
    .filter((paragraph) => paragraph.length > 0)

  return (
    <div style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
      {paragraphs.map((paragraph, index) => {
        const sectionMatch = paragraph.match(/^【(.+?)】([\s\S]*)/)
        if (sectionMatch) {
          const sectionLines = sectionMatch[2]
            .trim()
            .split(/\n/)
            .map((line) => stripMarkdownHeadings(line.trim()))
            .filter((line) => line.length > 0)

          const config = findSectionConfig(sectionMatch[1])
          return (
            <div key={index} style={{ marginBottom: index < paragraphs.length - 1 ? '20px' : 0 }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: config.color,
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
                  {config.icon}
                </span>
                {sectionMatch[1]}
              </div>
              {sectionLines.map((line, lineIndex) => (
                <p key={lineIndex} style={{ margin: `0 0 ${lineIndex < sectionLines.length - 1 ? '4px' : '0'} 0` }}>
                  {renderMarkdownText(line)}
                </p>
              ))}
            </div>
          )
        }

        return (
          <p key={index} style={{ margin: `0 0 ${index < paragraphs.length - 1 ? '12px' : '0'} 0` }}>
            {renderMarkdownText(paragraph)}
          </p>
        )
      })}
    </div>
  )
}

function formatWeeklyPeriod(report: WeeklyReportItem): string {
  return `${report.week_start}〜${report.week_end}`
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!year || !monthNumber) {
    return month
  }

  return `${year}年${monthNumber}月`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isWeeklyReportItem(item: unknown): item is WeeklyReportItem {
  return typeof item === 'object' && item !== null && 'week_start' in item && 'week_end' in item && 'headline' in item
}

function isMonthlyReportItem(item: unknown): item is MonthlyReportItem {
  return typeof item === 'object' && item !== null && 'month' in item && 'headline' in item
}

function isCustomReportHistoryItem(item: unknown): item is CustomReportHistoryItem {
  return typeof item === 'object' && item !== null && 'id' in item && 'templateLabel' in item && 'createdAt' in item
}

function HistoryCardButton({
  topLabel,
  bottomLabel,
  onClick,
  disabled,
}: {
  readonly topLabel: string
  readonly bottomLabel: string
  readonly onClick?: () => void
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '14px 16px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          {topLabel}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {bottomLabel}
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)', flexShrink: 0 }}>
        chevron_right
      </span>
    </button>
  )
}

export default function ReportDetailScreen({
  reportId,
  weeklyReportWeekStart,
  monthlyReportMonth,
  onBack,
  onViewHistory,
  onViewWeeklyReport,
  onViewMonthlyReport,
  onViewCustomReport,
}: ReportDetailScreenProps) {
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [historyItems, setHistoryItems] = useState<Array<unknown>>([])
  const reportType: ReportType = weeklyReportWeekStart
    ? 'weekly'
    : monthlyReportMonth
      ? 'monthly'
      : 'custom'

  const headerIcon = reportType === 'weekly'
    ? { name: 'calendar_month', color: 'var(--accent-color)' }
    : reportType === 'monthly'
      ? { name: 'date_range', color: 'var(--accent-indigo)' }
      : { name: 'psychology', color: 'var(--accent-color)' }

  useEffect(() => {
    let alive = true

    const load = async () => {
      setState({ status: 'loading' })
      setHistoryItems([])

      try {
        if (weeklyReportWeekStart) {
          const [report, reports] = await Promise.all([
            fetchWeeklyReportByWeekStart(weeklyReportWeekStart),
            fetchWeeklyReports(6),
          ])

          if (!alive) {
            return
          }

          setState({
            status: 'success',
            text: report.report,
            title: `週次レポート ${formatWeeklyPeriod(report)}`,
          })
          setHistoryItems(
            reports
              .filter((item) => item.week_start !== weeklyReportWeekStart)
              .slice(0, 5),
          )
          return
        }

        if (monthlyReportMonth) {
          const [report, reports] = await Promise.all([
            fetchMonthlyReportByMonth(monthlyReportMonth),
            fetchMonthlyReports(6),
          ])

          if (!alive) {
            return
          }

          setState({
            status: 'success',
            text: report.report,
            title: `月次レポート ${formatMonthLabel(report.month)}`,
          })
          setHistoryItems(
            reports
              .filter((item) => item.month !== monthlyReportMonth)
              .slice(0, 5),
          )
          return
        }

        if (reportId == null) {
          if (alive) {
            setState({ status: 'error', message: 'レポートIDがありません' })
          }
          return
        }

        const [reportText, reports] = await Promise.all([
          fetchCustomReportById(reportId),
          fetchCustomReportsHistory(),
        ])

        if (!alive) {
          return
        }

        setState({
          status: 'success',
          text: reportText,
          title: '追加レポート',
        })
        setHistoryItems(
          reports
            .filter((item) => item.id !== reportId)
            .slice(0, 5),
        )
      } catch (error) {
        if (alive) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'レポートを読み込めませんでした',
          })
        }
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [monthlyReportMonth, reportId, weeklyReportWeekStart])

  const weeklyHistoryItems = historyItems.filter(isWeeklyReportItem)
  const monthlyHistoryItems = historyItems.filter(isMonthlyReportItem)
  const customHistoryItems = historyItems.filter(isCustomReportHistoryItem)
  const hasHistorySection = historyItems.length > 0

  const headerTitle = state.status === 'success'
    ? state.title
    : weeklyReportWeekStart
      ? `週次レポート ${weeklyReportWeekStart}`
      : monthlyReportMonth
        ? `月次レポート ${formatMonthLabel(monthlyReportMonth)}`
        : '追加レポート'

  return (
    <div style={{ padding: '0 16px 32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 0',
          marginBottom: '8px',
        }}
      >
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
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>
            arrow_back
          </span>
        </button>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '20px', color: headerIcon.color, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}
          >
            {headerIcon.name}
          </span>
          <span style={{ minWidth: 0 }}>{headerTitle}</span>
        </span>
      </div>

      {state.status === 'loading' ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          読み込み中...
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div
          style={{
            padding: '16px',
            background: 'var(--danger-bg, #fef2f2)',
            color: 'var(--danger-color, #dc2626)',
            borderRadius: '12px',
            fontSize: '13px',
          }}
        >
          {state.message}
        </div>
      ) : null}

      {state.status === 'success' ? (
        <>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '20px 20px 16px 20px',
                background: 'linear-gradient(to bottom, var(--surface-subtle), var(--surface))',
                borderBottom: '1px solid rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid white',
                  boxShadow: '0 4px 12px rgba(45,139,111,0.15)',
                  background: 'white',
                }}
              >
                <img
                  src="/haru-avatar.png"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>

            <div style={{ padding: '0 20px 24px 20px' }}>
              {renderReportBody(state.text)}
            </div>
          </div>

          {hasHistorySection ? (
            <section style={{ marginTop: '24px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                }}
              >
                他のレポート
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reportType === 'weekly'
                  ? weeklyHistoryItems.map((item) => (
                    <HistoryCardButton
                      key={item.week_start}
                      topLabel={formatWeeklyPeriod(item)}
                      bottomLabel={item.headline}
                      onClick={() => onViewWeeklyReport?.(item.week_start)}
                      disabled={!onViewWeeklyReport}
                    />
                  ))
                  : null}
                {reportType === 'monthly'
                  ? monthlyHistoryItems.map((item) => (
                    <HistoryCardButton
                      key={item.month}
                      topLabel={formatMonthLabel(item.month)}
                      bottomLabel={item.headline}
                      onClick={() => onViewMonthlyReport?.(item.month)}
                      disabled={!onViewMonthlyReport}
                    />
                  ))
                  : null}
                {reportType === 'custom'
                  ? customHistoryItems.map((item) => (
                    <HistoryCardButton
                      key={item.id}
                      topLabel={item.templateLabel}
                      bottomLabel={formatDateTime(item.createdAt)}
                      onClick={() => onViewCustomReport?.(item.id)}
                      disabled={!onViewCustomReport}
                    />
                  ))
                  : null}
              </div>
            </section>
          ) : null}

          {onViewHistory ? (
            <button
              type="button"
              onClick={onViewHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                marginTop: '16px',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--surface)',
                fontSize: '13px',
                color: 'var(--accent-color)',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                history
              </span>
              履歴を見る
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
