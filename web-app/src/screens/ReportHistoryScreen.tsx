import { useEffect, useState } from 'react'
import { fetchCustomReportsHistory, fetchMonthlyReports, fetchWeeklyReports } from '../api/reports'
import type { CustomReportHistoryItem, MonthlyReportItem, WeeklyReportItem } from '../api/types'
import './ReportHistoryScreen.css'

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
    <div className="report-history-empty">
      <span className="material-symbols-outlined report-history-empty-icon">history_toggle_off</span>
      <div>レポート履歴がありません</div>
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
    <div className="report-history-container">
      <div className="report-history-header">
        <button
          type="button"
          onClick={onBack}
          className="report-history-back-btn"
          aria-label="戻る"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            arrow_back
          </span>
        </button>
        <span className="report-history-title">レポート履歴</span>
      </div>

      <div className="report-history-tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`report-history-tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="report-history-loading">読み込み中...</div>
      ) : null}

      {!loading && activeTab === 'weekly' ? (
        weeklyReports.length > 0 ? (
          <div className="report-history-list">
            {weeklyReports.map((report) => (
              <div
                key={report.week_start}
                role="button"
                tabIndex={0}
                className="report-history-card"
                onClick={() => onViewWeeklyReport(report.week_start)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewWeeklyReport(report.week_start)
                  }
                }}
              >
                <div className="report-history-card-content">
                  <div className="report-history-date">
                    {report.week_start}〜{report.week_end}
                  </div>
                  <div className="report-history-headline">
                    {report.headline}
                  </div>
                </div>
                <span className="material-symbols-outlined report-history-arrow">chevron_right</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyList />
        )
      ) : null}

      {!loading && activeTab === 'monthly' ? (
        monthlyReports.length > 0 ? (
          <div className="report-history-list">
            {monthlyReports.map((report) => (
              <div
                key={report.month}
                role="button"
                tabIndex={0}
                className="report-history-card"
                onClick={() => onViewMonthlyReport(report.month)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewMonthlyReport(report.month)
                  }
                }}
              >
                <div className="report-history-card-content">
                  <div className="report-history-date">
                    {formatMonthLabel(report.month)}
                  </div>
                  <div className="report-history-headline">
                    {report.headline}
                  </div>
                </div>
                <span className="material-symbols-outlined report-history-arrow">chevron_right</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyList />
        )
      ) : null}

      {!loading && activeTab === 'custom' ? (
        customReports.length > 0 ? (
          <div className="report-history-list">
            {customReports.map((report) => (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                className="report-history-card"
                onClick={() => onViewCustomReport(report.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onViewCustomReport(report.id)
                  }
                }}
              >
                <div className="report-history-card-content">
                  <div className="report-history-headline" style={{ marginBottom: '6px' }}>
                    {report.templateLabel}
                  </div>
                  <div className="report-history-date">
                    {formatDateTime(report.createdAt)}
                  </div>
                </div>
                <span className="material-symbols-outlined report-history-arrow">chevron_right</span>
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
