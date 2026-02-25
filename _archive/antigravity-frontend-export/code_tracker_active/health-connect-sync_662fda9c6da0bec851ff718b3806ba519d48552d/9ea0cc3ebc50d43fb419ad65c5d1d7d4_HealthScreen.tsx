Åimport { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import SegmentSelector from '../components/SegmentSelector'
import type { Segment } from '../components/SegmentSelector'
import {
  fetchBodyData, fetchSleepData, fetchVitalsData
} from '../api/healthApi'
import type {
  BodyDataResponse, SleepDataResponse, VitalsDataResponse
} from '../api/types'
import './HealthScreen.css'

type InnerTab = 'composition' | 'circulation' | 'sleep'

function formatXLabel(dateStr: string, segment: Segment): string {
  const WEEKDAYS = ['æ—¥', 'æœˆ', 'ç«', 'æ°´', 'æœ¨', 'é‡‘', 'åœŸ']
  if (!dateStr) return ''
  if (segment === 'week') {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number)
      return WEEKDAYS[new Date(y, m - 1, d).getDay()]
    }
    return dateStr
  }
  if (segment === 'year') {
    // dateStr ã¯ 'YYYY-MM' å½¢å¼
    const parts = dateStr.split('-')
    if (parts.length >= 2) return `${parseInt(parts[1], 10)}æœˆ`
    return dateStr
  }
  // month: 5æ—¥ã”ã¨ã®ã¿è¡¨ç¤º
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10)
    const d = parseInt(parts[2], 10)
    return d % 5 === 1 || d === 1 ? `${m}/${d}` : ''
  }
  return dateStr
}

function formatTooltipLabel(dateStr: string, segment: Segment): string {
  const WEEKDAYS = ['æ—¥', 'æœˆ', 'ç«', 'æ°´', 'æœ¨', 'é‡‘', 'åœŸ']
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (segment === 'week' || segment === 'month') {
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number)
      const w = WEEKDAYS[new Date(y, m - 1, d).getDay()]
      return `${m}/${d} (${w})`
    }
  }
  if (segment === 'year') {
    if (parts.length >= 2) return `${parseInt(parts[0], 10)}å¹´${parseInt(parts[1], 10)}æœˆ`
  }
  return dateStr
}

// InnerTabBar Component
function InnerTabBar({ tab, onTabChange }: { tab: InnerTab, onTabChange: (t: InnerTab) => void }) {
  return (
    <div className="inner-tab-bar">
      <button type="button" className={`inner-tab ${tab === 'composition' ? 'active' : ''}`} onClick={() => onTabChange('composition')}>ä½“çµ„æˆ</button>
      <button type="button" className={`inner-tab ${tab === 'circulation' ? 'active' : ''}`} onClick={() => onTabChange('circulation')}>ãƒã‚¤ã‚¿ãƒ«</button>
      <button type="button" className={`inner-tab ${tab === 'sleep' ? 'active' : ''}`} onClick={() => onTabChange('sleep')}>ç¡çœ </button>
    </div>
  )
}

// CompositionTab Component
function CompositionTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<BodyDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchBodyData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">èª­ã¿è¾¼ã¿ä¸­...</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“</span></div>

  const current = data.current
  const useAverageCard = segment !== 'week'
  const displayWeight = useAverageCard ? (data.periodSummary.avg_weight_kg ?? current.weight_kg) : current.weight_kg
  const displayBodyFat = useAverageCard ? (data.periodSummary.avg_body_fat_pct ?? current.body_fat_pct) : current.body_fat_pct
  const displayBmi = useAverageCard ? (data.periodSummary.avg_bmi ?? current.bmi) : current.bmi

  // é€±æ¬¡å¤‰åŒ–ã®è¨ˆç®— (for week segment)
  const isWeek = segment === 'week'
  let diffWeight = 0
  let diffFat = 0
  if (isWeek && data.series.length > 0) {
    const first = data.series[0]
    const last = data.series[data.series.length - 1]
    if (last.weight_kg && first.weight_kg) diffWeight = last.weight_kg - first.weight_kg
    if (last.body_fat_pct && first.body_fat_pct) diffFat = last.body_fat_pct - first.body_fat_pct
  }

  return (
    <div className="tab-content">
      <div className="health-current-card">
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡ä½“é‡' : 'ä½“é‡'}</span>
          <span className="health-metric-value">{displayWeight?.toFixed(1) ?? '-'} kg</span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡ä½“è„‚è‚ª' : 'ä½“è„‚è‚ª'}</span>
          <span className="health-metric-value">{displayBodyFat?.toFixed(1) ?? '-'} %</span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡BMI' : 'BMI'}</span>
          <span className="health-metric-value">
            {displayBmi != null && <span className={`status-badge ${displayBmi < 25 ? 'good' : 'warning'}`} style={{ marginRight: 8 }}>{displayBmi < 25 ? 'æ¨™æº–' : 'è»½åº¦è‚¥æº€'}</span>}
            {displayBmi?.toFixed(1) ?? '-'}
          </span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">ç›®æ¨™ä½“é‡</span>
          <span className="health-metric-value">{data.goalWeight?.toFixed(1) ?? '-'} kg</span>
        </div>
      </div>

      <div className="health-chart-container">
        <div className="health-chart-title">ä½“é‡ã¨ä½“è„‚è‚ªã®æ¨ç§»</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            {segment === 'year' ? (
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                {data.goalWeight != null && <ReferenceLine y={data.goalWeight} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'ç›®æ¨™', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 12 }} />}
                <Line type="monotone" dataKey="weight_kg" name="ä½“é‡ (kg)" stroke="var(--accent-color)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} width={40} hide />
                <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                {data.goalWeight != null && <ReferenceLine yAxisId="left" y={data.goalWeight} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'ç›®æ¨™', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 12 }} />}
                <Line yAxisId="right" type="monotone" dataKey="body_fat_pct" name="ä½“è„‚è‚ª (%)" stroke="#FFCC80" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line yAxisId="left" type="monotone" dataKey="weight_kg" name="ä½“é‡ (kg)" stroke="var(--accent-color)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {isWeek && (
        <div className="health-list-container">
          <div className="health-list-item">
            <span className="health-list-item-label">ä»Šé€±ã®å¤‰åŒ–</span>
            <span className="health-list-item-value">
              {diffWeight > 0 ? '+' : ''}{diffWeight.toFixed(1)}kg / {diffFat > 0 ? '+' : ''}{diffFat.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// CirculationTab Component
function CirculationTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<VitalsDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchVitalsData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">èª­ã¿è¾¼ã¿ä¸­...</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“</span></div>

  const current = data.current
  const useAverageCard = segment !== 'week'
  const displaySystolic = useAverageCard ? (data.periodSummary.avg_systolic ?? current.systolic) : current.systolic
  const displayDiastolic = useAverageCard ? (data.periodSummary.avg_diastolic ?? current.diastolic) : current.diastolic
  const displayRestingHr = useAverageCard ? (data.periodSummary.avg_resting_hr ?? current.resting_hr) : current.resting_hr

  let bpStatus = 'æ­£å¸¸'
  let bpClass = 'good'
  if (displaySystolic && displayDiastolic) {
    if (displaySystolic >= 140 || displayDiastolic >= 90) { bpStatus = 'è¦ç¢ºèª'; bpClass = 'danger' }
    else if (displaySystolic >= 130 || displayDiastolic >= 85) { bpStatus = 'æ³¨æ„'; bpClass = 'warning' }
  }

  return (
    <div className="tab-content">
      <div className="health-current-card">
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡è¡€åœ§' : 'è¡€åœ§'}</span>
          <span className="health-metric-value">
            {displaySystolic != null && <span className={`status-badge ${bpClass}`} style={{ marginRight: 8 }}>{bpStatus}</span>}
            {displaySystolic ?? '-'}/{displayDiastolic ?? '-'} mmHg
          </span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡å®‰é™æ™‚å¿ƒæ‹' : 'å®‰é™æ™‚å¿ƒæ‹'}</span>
          <span className="health-metric-value">
            {displayRestingHr != null && <span className={`status-badge ${displayRestingHr < 80 ? 'good' : 'warning'}`} style={{ marginRight: 8 }}>{displayRestingHr < 80 ? 'è‰¯å¥½' : 'é«˜ã‚'}</span>}
            {displayRestingHr ?? '-'} bpm
          </span>
        </div>
      </div>

      <div className="health-chart-container">
        <div className="health-chart-title">è¡€åœ§ã®æ¨ç§»</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 10', 'auto']} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={130} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '130', position: 'right', fontSize: 10 }} />
              <ReferenceLine y={85} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: '85', position: 'right', fontSize: 10 }} />
              <Line type="monotone" dataKey="systolic" name="åç¸®æœŸ" stroke="#EF9A9A" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="diastolic" name="æ‹¡å¼µæœŸ" stroke="#90CAF9" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// SleepTab Component
function SleepTab({ date, segment }: { date: string, segment: Segment }) {
  const [data, setData] = useState<SleepDataResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchSleepData(date, segment)
      .then(res => { if (mounted) { setData(res); setLoading(false) } })
      .catch(() => { if (mounted) { setData(null); setLoading(false) } })
    return () => { mounted = false }
  }, [date, segment])

  if (loading) return <div className="health-empty-state"><span className="health-empty-text">èª­ã¿è¾¼ã¿ä¸­...</span></div>
  if (!data || data.series.length === 0) return <div className="health-empty-state"><span className="health-empty-text">ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“</span></div>

  const current = data.current
  const stages = data.stages
  const useAverageCard = segment !== 'week'
  const displaySleepMinutes = useAverageCard ? (data.periodSummary.avg_sleep_min ?? current.sleep_minutes) : current.sleep_minutes
  const displayAvgSpo2 = useAverageCard ? (data.periodSummary.avg_spo2 ?? current.avg_spo2) : current.avg_spo2
  const displayMinSpo2 = useAverageCard ? (data.periodSummary.min_spo2 ?? current.min_spo2) : current.min_spo2

  const formatHours = (min: number | null | undefined) => {
    if (min == null) return '-'
    const h = Math.floor(min / 60)
    const m = Math.floor(min % 60)
    return `${h}æ™‚é–“${m}åˆ†`
  }

  let sleepStatus = 'çŸ­ã‚'
  let sleepClass = 'danger'
  if (displaySleepMinutes) {
    if (displaySleepMinutes >= 420) { sleepStatus = 'è‰¯å¥½'; sleepClass = 'good' }
    else if (displaySleepMinutes >= 360) { sleepStatus = 'ã‚„ã‚„çŸ­ã‚'; sleepClass = 'warning' }
  }

  // Convert minutes to hours for display
  const chartData = data.series.map(d => ({
    ...d,
    total_h: d.sleep_minutes != null ? Number((d.sleep_minutes / 60).toFixed(1)) : 0,
    deep_h: d.deep_min != null ? Number((d.deep_min / 60).toFixed(1)) : 0,
    light_h: d.light_min != null ? Number((d.light_min / 60).toFixed(1)) : 0,
    rem_h: d.rem_min != null ? Number((d.rem_min / 60).toFixed(1)) : 0,
  }))

  return (
    <div className="tab-content">
      <div className="health-current-card">
        <div className="health-metric-row">
          <span className="health-metric-label">{useAverageCard ? 'å¹³å‡ç¡çœ ' : 'ç¡çœ '}</span>
          <span className="health-metric-value">
            {displaySleepMinutes != null && <span className={`status-badge ${sleepClass}`} style={{ marginRight: 8 }}>{sleepStatus}</span>}
            {formatHours(displaySleepMinutes)}
          </span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">å°±å¯ / èµ·åºŠ</span>
          <span className="health-metric-value">
            {useAverageCard ? '- / -' : `${current.bedtime ?? '-'} / ${current.wake_time ?? '-'}`}
          </span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">ã‚¹ãƒ†ãƒ¼ã‚¸</span>
          <span className="health-metric-value" style={{ fontSize: '13px', fontWeight: 600 }}>
            æ·±ã„: {stages.deep_min ?? '-'}åˆ†  æµ…ã„: {stages.light_min ?? '-'}åˆ†  ãƒ¬ãƒ ç¡çœ : {stages.rem_min ?? '-'}åˆ†
          </span>
        </div>
        <div className="health-metric-row">
          <span className="health-metric-label">è¡€ä¸­é…¸ç´ </span>
          <span className="health-metric-value" style={{ fontSize: '13px', fontWeight: 600 }}>
            å¹³å‡: {displayAvgSpo2 ?? '-'}%  æœ€ä½: {displayMinSpo2 ?? '-'}%
          </span>
        </div>
      </div>

      <div className="health-chart-container">
        <div className="health-chart-title">ç¡çœ æ™‚é–“ã®æ¨ç§»</div>
        <div className="health-chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="date" tickFormatter={(v) => formatXLabel(v, segment)} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#8FA39A' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip labelFormatter={(v) => formatTooltipLabel(v as string, segment)} formatter={(val: number | undefined) => typeof val === 'number' ? val.toFixed(1) : val} cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <ReferenceLine y={7} stroke="#8FA39A" strokeDasharray="4 4" label={{ value: 'ç›®æ¨™7h', position: 'insideTopRight', fill: '#8FA39A', fontSize: 10 }} />
              <Bar dataKey="deep_h" name="æ·±ç¡çœ " stackId="a" fill="#6BCB9F" radius={segment === 'week' ? [0, 0, 0, 0] : [0, 0, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
              <Bar dataKey="light_h" name="æµ…ç¡çœ " stackId="a" fill="#A5D6A7" radius={[0, 0, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
              <Bar dataKey="rem_h" name="ãƒ¬ãƒ ç¡çœ " stackId="a" fill="#FFCC80" radius={[4, 4, 0, 0]} barSize={segment === 'week' ? 16 : segment === 'month' ? 4 : 8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="health-list-container">
        <div className="health-list-item">
          <span className="health-list-item-label">å¹³å‡ç¡çœ </span>
          <span className="health-list-item-value">{formatHours(data.periodSummary.avg_sleep_min)}</span>
        </div>
        <div className="health-list-item">
          <span className="health-list-item-label">ç›®æ¨™é”æˆæ—¥</span>
          <span className="health-list-item-value">{data.periodSummary.goal_days} æ—¥</span>
        </div>
      </div>
    </div>
  )
}

export default function HealthScreen({ initialTab = 'composition' }: { initialTab?: InnerTab }) {
  const { activeDate } = useDateContext()
  const [tab, setTab] = useState<InnerTab>(initialTab)
  const [segment, setSegment] = useState<Segment>('week')

  return (
    <div className="health-container">
      <DateNavBar />
      <InnerTabBar tab={tab} onTabChange={setTab} />
      <SegmentSelector value={segment} onChange={(v: string) => setSegment(v as Segment)} />
      {tab === 'composition' && <CompositionTab date={activeDate} segment={segment} />}
      {tab === 'circulation' && <CirculationTab date={activeDate} segment={segment} />}
      {tab === 'sleep' && <SleepTab date={activeDate} segment={segment} />}
    </div>
  )
}
¹ ¹º*cascade08
º» »¼*cascade08
¼Ì ÌÍ*cascade08
Í· ·»*cascade08
»º$ º$Ó$*cascade08
Ó$Ù$ Ù$æ$*cascade08
æ$ %  %¨%*cascade08
¨%º& º&Ó&*cascade08
Ó&Ü& Ü&ì&*cascade08
ì&¦' ¦'®'*cascade08
®'±' ±'²'*cascade08
²'À( À(Ù(*cascade08
Ù(Ü( Ü(æ(*cascade08
æ(®) ®)¶)*cascade08
¶)å) å)í)*cascade08
í)©* ©*±**cascade08
±*ì* ì*ô**cascade08
ô*ûN ûN’R*cascade08
’RÍR ÍRÏR*cascade08
ÏRĞR ĞRÕR*cascade08
ÕRáR áRèR*cascade08
èRıR ıRÿR*cascade08
ÿR€S €S…S*cascade08
…S™S ™S S*cascade08
 SìS ìSîS*cascade08
îSïS ïSôS*cascade08
ôS‡T ‡TT*cascade08
TŒV ŒV¥V*cascade08
¥V«V «V¸V*cascade08
¸V€W €W‚W*cascade08
‚WƒW ƒWˆW*cascade08
ˆWƒX ƒX…X*cascade08
…X†X †X‹X*cascade08
‹XX X¤X*cascade08
¤X»Y »YÔY*cascade08
ÔYãY ãYùY*cascade08
ùYÁZ ÁZÉZ*cascade08
ÉZÏZ ÏZĞZ*cascade08
ĞZşZ şZ†[*cascade08
†[Œ[ Œ[[*cascade08
[È[ È[Ğ[*cascade08
Ğ[Ö[ Ö[×[*cascade08
×[‹\ ‹\“\*cascade08
“\™\ ™\š\*cascade08
š\›p ›p¬s*cascade08
¬s¼u ¼u¾u*cascade08
¾u¿u ¿uÄu*cascade08
ÄuÈu ÈuÉu*cascade08
ÉuÜu ÜuŞu*cascade08
Şußu ßuäu*cascade08
äuèu èuéu*cascade08
éu¶v ¶v¸v*cascade08
¸v¹v ¹v¾v*cascade08
¾vÂv ÂvÃv*cascade08
Ãvó{ ó{Œ|*cascade08
Œ|’| ’|Ÿ|*cascade08
Ÿ|ç| ç|é|*cascade08
é|ê| ê|ï|*cascade08
ï|ó| ó|ô|*cascade08
ô|€~ €~‚~*cascade08
‚~ƒ~ ƒ~ˆ~*cascade08
ˆ~Œ~ Œ~~*cascade08
~ß ß‹€*cascade08‹€¦€ ¦€§€*cascade08§€Á€ Á€Ï€*cascade08Ï€Å… Å…Ê…*cascade08Ê…Ë… Ë…Í…*cascade08Í…Ï… Ï…Ğ…*cascade08Ğ…ç… ç…ï…*cascade08ï…ñ… ñ…ò…*cascade08ò…Å "(662fda9c6da0bec851ff718b3806ba519d48552d2Nfile:///c:/Users/user/health-connect-sync/web-app/src/screens/HealthScreen.tsx:)file:///c:/Users/user/health-connect-sync