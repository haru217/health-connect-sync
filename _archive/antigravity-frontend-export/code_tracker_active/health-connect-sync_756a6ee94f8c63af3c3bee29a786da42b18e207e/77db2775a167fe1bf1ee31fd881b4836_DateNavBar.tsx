�	import { useDateContext } from '../context/DateContext'
import './DateNavBar.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function formatLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = new Date()
  const isToday =
    dt.getFullYear() === today.getFullYear() &&
    dt.getMonth() === today.getMonth() &&
    dt.getDate() === today.getDate()
  const day = WEEKDAYS[dt.getDay()]
  if (isToday) return `${m}月${d}日（${day}）今日`
  return `${m}月${d}日（${day}）`
}

export default function DateNavBar() {
  const { activeDate, goBack, goForward, isToday } = useDateContext()

  return (
    <div className="date-nav-bar">
      <button type="button" className="date-nav-btn" onClick={goBack} aria-label="前の日">
        ‹
      </button>
      <span className="date-nav-label">{formatLabel(activeDate)}</span>
      <button
        type="button"
        className={`date-nav-btn ${isToday ? 'disabled' : ''}`}
        onClick={goForward}
        disabled={isToday}
        aria-label="次の日"
      >
        ›
      </button>
    </div>
  )
}
�	"(756a6ee94f8c63af3c3bee29a786da42b18e207e2Ofile:///c:/Users/user/health-connect-sync/web-app/src/components/DateNavBar.tsx:)file:///c:/Users/user/health-connect-sync