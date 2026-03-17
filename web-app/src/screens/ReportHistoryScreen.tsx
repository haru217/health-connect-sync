import { useEffect, useState } from 'react'
import { fetchCustomReportsHistory, fetchMonthlyReports, fetchWeeklyReports } from '../api/reports'
import type { CustomReportHistoryItem, MonthlyReportItem, WeeklyReportItem } from '../api/types'

type ReportHistoryTab = 'weekly' | 'monthly' | 'custom'

interface ReportHistoryScreenProps {
  initialTab: 'weekly' | 'monthly' | 'custom'
  onBack: () => void
  onViewWeeklyReport: (weekStart: string) => void
  onViewMonthlyReport: (month: string) => void
  onViewCustomReport: (id: number) => void
}

const TAB_OPTIONS: ReadonlyArray<{ key: ReportHistoryTab; label: string }> = [
  { key: 'weekly', label: '週次' },
  { key: 'monthly', label: '月次' },
  { key: 'custom', label: 'カスタム' },
]

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) {
    return month
  }
  return `${year}年${monthNumber}月`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EmptyList() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '18px 16px',
        color: 'var(--text-muted)',
        fontSize: '13px',
        textAlign: 'center',
      }}
    >
      レポートがありません
    </div>
  )
}

export default function ReportHistoryScreen({
  initialTab,
  onBack,
  onViewWeeklyReport,
  onViewMonthlyReport,
  onViewCustomReport,
}: ReportHistoryScreenProps) {
  const [activeTab, setActiveTab] = useState<ReportHistoryTab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportItem[]>([])
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportItem[]>([])
  const [customReports, setCustomReports] = useState<CustomReportHistoryItem[]>([])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    let alive = true
    setLoading(true)

    Promise.all([
      fetchWeeklyReports(20),
      fetchMonthlyReports(20),
      fetchCustomReportsHistory(),
    ])
      .then(([weekly, monthly, custom]) => {
        if (!alive) {
          return
        }
        setWeeklyReports(weekly)
        setMonthlyReports(monthly)
        setCustomReports(custom)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) {
          return
        }
        setWeeklyReports([])
        setMonthlyReports([])
        setCustomReports([])
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

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
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>レポート履歴</span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '14px',
        }}
      >
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: '8px',
              padding: '8px 0',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--accent-color)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</div>
      ) : null}

      {!loading && activeTab === 'weekly' ? (
        weeklyReports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {weeklyReports.map((report) => (
              <div
                key={report.week_start}
                role="button"
                tabIndex={0}
                onClick={() => onViewWeeklyReport(report.week_start)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewWeeklyReport(report.week_start)
                  }
                }}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {report.week_start}〜{report.week_end}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                  {report.headline}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyList />
        )
      ) : null}

      {!loading && activeTab === 'monthly' ? (
        monthlyReports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {monthlyReports.map((report) => (
              <div
                key={report.month}
                role="button"
                tabIndex={0}
                onClick={() => onViewMonthlyReport(report.month)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewMonthlyReport(report.month)
                  }
                }}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {formatMonthLabel(report.month)}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                  {report.headline}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyList />
        )
      ) : null}

      {!loading && activeTab === 'custom' ? (
        customReports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {customReports.map((report) => (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewCustomReport(report.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewCustomReport(report.id)
                  }
                }}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
                  {report.templateLabel}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatDateTime(report.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyList />
        )
      ) : null}
    </div>
  )
}
