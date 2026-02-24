import React from 'react'
import './SegmentSelector.css'

export type Segment = 'week' | 'month' | 'year'

interface SegmentSelectorProps {
  value: Segment
  onChange: (v: Segment) => void
}

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

export default function SegmentSelector({ value, onChange }: SegmentSelectorProps) {
  return (
    <div className="segment-selector">
      {SEGMENTS.map(s => (
        <button
          key={s.value}
          type="button"
          className={`segment-btn ${value === s.value ? 'active' : ''}`}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
