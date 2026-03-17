import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './HaruBriefing.css'

interface HaruBriefingProps {
  briefing?: string | null
  activeDate: string
  onGenerate: () => void
  generating: boolean
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toMonthDay(dateText: string): string {
  const [year, month, day] = dateText.split('-').map(Number)
  if (!year || !month || !day) return dateText
  return `${month}月${day}日`
}

function renderMarkdownText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ fontWeight: 'bold' }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={index}>{part}</span>
  })
}

const sectionConfig = {
  からだ: { icon: 'favorite', color: 'var(--accent-red)' },
  運動: { icon: 'directions_run', color: 'var(--accent-blue)' },
  活動: { icon: 'directions_run', color: 'var(--accent-blue)' },
  食事: { icon: 'restaurant', color: 'var(--accent-color)' },
  睡眠: { icon: 'bedtime', color: 'var(--accent-yellow)' },
  まとめ: { icon: 'psychology', color: 'var(--accent-indigo)' },
  その他: { icon: 'info', color: 'var(--text-muted)' },
} as const

export default function HaruBriefing({ briefing, activeDate, onGenerate, generating }: HaruBriefingProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [revealedParagraphs, setRevealedParagraphs] = useState<number[]>([])

  const paragraphs = useMemo(
    () => (briefing ? briefing.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0) : []),
    [briefing],
  )

  useEffect(() => {
    setIsVisible(true)
    setRevealedParagraphs([])

    if (!generating && paragraphs.length > 0) {
      const timers = paragraphs.map((_, index) => setTimeout(() => {
        setRevealedParagraphs((prev) => [...prev, index])
      }, 300 + index * 150))

      return () => {
        timers.forEach((timerId) => clearTimeout(timerId))
      }
    }

    return undefined
  }, [generating, paragraphs])

  const renderBubble = (content: ReactNode) => (
    <section className="haru-briefing-section" style={{ flexGrow: 1 }}>
      <div style={{
        position: 'relative',
        background: 'var(--surface)',
        borderRadius: '20px 20px 20px 6px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        border: '1px solid var(--border-color)',
        padding: '0',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      }}>
        <div style={{
          position: 'absolute',
          left: '-8px',
          top: '25px',
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '10px 10px 10px 0',
          borderColor: 'transparent var(--border-color) transparent transparent',
        }} />
        <div style={{
          position: 'absolute',
          left: '-6px',
          top: '26px',
          width: '0',
          height: '0',
          borderStyle: 'solid',
          borderWidth: '9px 9px 9px 0',
          borderColor: 'transparent var(--surface) transparent transparent',
        }} />
        <div style={{
          padding: '18px 20px 20px',
          fontSize: '15.5px',
          lineHeight: '1.75',
          color: 'var(--text-primary)',
        }}>
          {content}
        </div>
      </div>
    </section>
  )

  if (generating) {
    return renderBubble(
      <div className="typing-dots" aria-label="ブリーフィング生成中">
        <span />
        <span />
        <span />
      </div>,
    )
  }

  if (briefing) {
    return renderBubble(
      <>
        {paragraphs.map((para, i) => {
          const sectionMatch = para.match(/^【(.+?)】([\s\S]*)/)
          const isRevealed = revealedParagraphs.includes(i)
          const paragraphAnimStyle = {
            opacity: isRevealed ? 1 : 0,
            transform: isRevealed ? 'translateY(0)' : 'translateY(5px)',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }

          if (sectionMatch) {
            const sectionTitle = sectionMatch[1]
            const configEntry = Object.entries(sectionConfig).find(
              ([key]) => key !== 'その他' && sectionTitle.startsWith(key),
            )
            const config = configEntry ? configEntry[1] : sectionConfig.その他
            const sectionLines = sectionMatch[2].trim().split(/\n/).map((line) => line.trim()).filter((line) => line.length > 0)
            return (
              <div key={i} style={{ ...paragraphAnimStyle, marginBottom: i < paragraphs.length - 1 ? '20px' : '0' }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: config.color,
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
                    {config.icon}
                  </span>
                  {sectionTitle}
                </div>
                {sectionLines.map((line, j) => (
                  <p key={j} style={{ margin: `0 0 ${j < sectionLines.length - 1 ? '6px' : '0'} 0` }}>
                    {renderMarkdownText(line)}
                  </p>
                ))}
              </div>
            )
          }

          return (
            <p key={i} style={{ ...paragraphAnimStyle, margin: `0 0 ${i < paragraphs.length - 1 ? '16px' : '0'} 0` }}>
              {renderMarkdownText(para)}
            </p>
          )
        })}
      </>,
    )
  }

  const message = activeDate === toIsoDate(new Date())
    ? 'データを同期したら、ブリーフィングを作れるよ'
    : `${toMonthDay(activeDate)}のブリーフィングを作れるよ`

  return renderBubble(
    <>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)' }}>{message}</p>
      <button
        type="button"
        onClick={onGenerate}
        style={{
          border: 'none',
          borderRadius: '10px',
          padding: '10px 14px',
          background: 'var(--accent-color)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ブリーフィングを作る
      </button>
    </>,
  )
}
