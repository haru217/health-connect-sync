import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type DateContextType = {
  activeDate: string        // 'YYYY-MM-DD'
  setActiveDate: (date: string) => void
  goBack: () => void
  goForward: () => void
  isToday: boolean          // true when activeDate === today (blocks future nav)
}

const DateContext = createContext<DateContextType | null>(null)

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [activeDate, setActiveDate] = useState<string>(todayStr)

  const today = todayStr()
  const isToday = activeDate >= today

  const goBack = useCallback(() => {
    setActiveDate(prev => addDays(prev, -1))
  }, [])

  const goForward = useCallback(() => {
    setActiveDate(prev => {
      const next = addDays(prev, 1)
      return next > today ? prev : next
    })
  }, [today])

  const value = useMemo<DateContextType>(
    () => ({ activeDate, setActiveDate, goBack, goForward, isToday }),
    [activeDate, goBack, goForward, isToday],
  )

  return <DateContext.Provider value={value}>{children}</DateContext.Provider>
}

export function useDateContext(): DateContextType {
  const ctx = useContext(DateContext)
  if (!ctx) throw new Error('useDateContext must be used within DateProvider')
  return ctx
}
