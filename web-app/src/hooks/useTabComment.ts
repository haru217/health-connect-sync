import { useEffect, useState } from 'react'
import { fetchReport } from '../api/healthApi'
import type { ReportTabKey } from '../api/types'

type UseTabCommentResult = {
  comment: string | null
  loading: boolean
}

export function useTabComment(date: string, tabKey: ReportTabKey): UseTabCommentResult {
  const [comment, setComment] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setComment(null)

    const load = async () => {
      try {
        const report = await fetchReport(date)
        if (!alive) {
          return
        }
        const nextComment = report?.tabs?.[tabKey]
        if (typeof nextComment === 'string' && nextComment.trim().length > 0) {
          setComment(nextComment)
        } else {
          setComment(null)
        }
      } catch {
        if (alive) {
          setComment(null)
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [date, tabKey])

  return { comment, loading }
}
