import { useCallback, useEffect, useState } from 'react'
import { fetchPrompt, fetchReport, fetchReports, saveReport } from '../api/healthApi'
import type { ReportDetailResponse, ReportType, RequestState } from '../api/types'
import './AiScreen.css'

interface AgentComments {
  doctor: string
  trainer: string
  nutritionist: string
}

interface AiViewData {
  latest: ReportDetailResponse | null
  comments: AgentComments
}

function todayLocal(): string {
  return new Date().toLocaleDateString('sv-SE')
}

function extractAgentComments(content: string): AgentComments {
  const doctor = content.match(/<!--DOCTOR-->([\s\S]*?)(?=<!--TRAINER-->|<!--END-->|$)/)?.[1]?.trim() ?? ''
  const trainer = content.match(/<!--TRAINER-->([\s\S]*?)(?=<!--NUTRITIONIST-->|<!--END-->|$)/)?.[1]?.trim() ?? ''
  const nutritionist = content.match(/<!--NUTRITIONIST-->([\s\S]*?)(?=<!--END-->|$)/)?.[1]?.trim() ?? ''
  return { doctor, trainer, nutritionist }
}

export default function AiScreen() {
  const [period, setPeriod] = useState<ReportType>('daily')
  const [state, setState] = useState<RequestState<AiViewData>>({ status: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const list = await fetchReports(period)
      const latestItem = list.reports[0]
      if (!latestItem) {
        setState({
          status: 'success',
          data: {
            latest: null,
            comments: { doctor: '', trainer: '', nutritionist: '' },
          },
        })
        return
      }
      const latest = await fetchReport(latestItem.id)
      setState({
        status: 'success',
        data: {
          latest,
          comments: extractAgentComments(latest.content ?? ''),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      setState({ status: 'error', error: message })
    }
  }, [period])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const handleSaveReport = async () => {
    setActionError(null)
    try {
      const prompt = await fetchPrompt(period)
      const pasted = window.prompt('LLMの返答を貼り付けてください（そのまま保存されます）')
      if (!pasted || !pasted.trim()) {
        return
      }
      await saveReport({
        report_date: todayLocal(),
        report_type: period,
        prompt_used: prompt.prompt,
        content: pasted.trim(),
      })
      await loadReports()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'レポート保存エラー'
      setActionError(message)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="ai-container fade-in">
        <div className="card">読み込み中...</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="ai-container fade-in">
        <div className="card">読み込みエラー: {state.error}</div>
      </div>
    )
  }

  const latest = state.data.latest
  const comments = state.data.comments

  return (
    <>
      <div className="ai-container fade-in">
        <div className="segment-control">
          <div className={`segment-btn ripple ${period === 'daily' ? 'active' : ''}`} onClick={() => setPeriod('daily')}>
            日次
          </div>
          <div className={`segment-btn ripple ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>
            週次
          </div>
          <div
            className={`segment-btn ripple ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            月次
          </div>
        </div>

        {actionError && <div className="card">操作エラー: {actionError}</div>}

        <div className="ai-agents-section">
          <h3 className="section-title">エージェントコメント</h3>

          <div className="agent-card card ripple stagger-1">
            <div className="agent-header">
              <div className="agent-avatar doc-avatar">🩺</div>
              <div className="agent-info">
                <div className="agent-role">医師観点</div>
                <div className="agent-name">Dr. メディカル</div>
              </div>
            </div>
            <div className="agent-comment">{comments.doctor || 'コメントなし'}</div>
          </div>

          <div className="agent-card card ripple stagger-2">
            <div className="agent-header">
              <div className="agent-avatar trainer-avatar">🏃‍♂️</div>
              <div className="agent-info">
                <div className="agent-role">トレーナー観点</div>
                <div className="agent-name">フィットネスコーチ</div>
              </div>
            </div>
            <div className="agent-comment">{comments.trainer || 'コメントなし'}</div>
          </div>

          <div className="agent-card card ripple stagger-3">
            <div className="agent-header">
              <div className="agent-avatar nut-avatar">🥗</div>
              <div className="agent-info">
                <div className="agent-role">栄養士観点</div>
                <div className="agent-name">ニュートリション専門家</div>
              </div>
            </div>
            <div className="agent-comment">{comments.nutritionist || 'コメントなし'}</div>
          </div>
        </div>

        <button className="primary-action-btn ripple stagger-4" onClick={() => void handleSaveReport()}>
          <span className="btn-icon">✨</span> 新しいレポートを保存
        </button>

        <div className="report-detail-section card stagger-5" style={{ marginTop: '24px' }}>
          <h3 className="section-title">詳細レポート</h3>
          <div className="markdown-content">
            {!latest ? (
              <p>保存済みレポートがありません。</p>
            ) : (
              <>
                <p>
                  <strong>
                    {latest.report_date} / {latest.report_type}
                  </strong>
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{latest.content}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <button className="fab ripple" aria-label="共有する">
        📤
      </button>
    </>
  )
}
