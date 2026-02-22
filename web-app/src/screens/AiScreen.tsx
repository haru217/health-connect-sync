import { useCallback, useEffect, useState } from 'react'
import { fetchPrompt, fetchReport, fetchReports, saveReport } from '../api/healthApi'
import type { ReportDetailResponse, ReportType, RequestState } from '../api/types'
import './AiScreen.css'
import advisorDoctor from '../assets/advisor_doctor.png'
import advisorTrainer from '../assets/advisor_trainer.png'
import advisorNutritionist from '../assets/advisor_nutritionist.png'

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

          <div className="ai-insight-section stagger-1">
            <div className="ai-insight-avatar doc-avatar">
              <img src={advisorDoctor} alt="Dr. メディカル" />
            </div>
            <div className="ai-insight-bubble">
              <div className="agent-info">
                <span className="agent-role">医師観点</span>
                <span className="agent-name">Dr. メディカル</span>
              </div>
              <p className="ai-insight-text">{comments.doctor || 'コメントなし'}</p>
            </div>
          </div>

          <div className="ai-insight-section stagger-2">
            <div className="ai-insight-avatar trainer-avatar">
              <img src={advisorTrainer} alt="フィットネスコーチ" />
            </div>
            <div className="ai-insight-bubble">
              <div className="agent-info">
                <span className="agent-role">トレーナー観点</span>
                <span className="agent-name">フィットネスコーチ</span>
              </div>
              <p className="ai-insight-text">{comments.trainer || 'コメントなし'}</p>
            </div>
          </div>

          <div className="ai-insight-section stagger-3">
            <div className="ai-insight-avatar nut-avatar">
              <img src={advisorNutritionist} alt="ニュートリション専門家" />
            </div>
            <div className="ai-insight-bubble">
              <div className="agent-info">
                <span className="agent-role">栄養士観点</span>
                <span className="agent-name">ニュートリション専門家</span>
              </div>
              <p className="ai-insight-text">{comments.nutritionist || 'コメントなし'}</p>
            </div>
          </div>
        </div>

        <button className="primary-action-btn ripple stagger-4" onClick={() => void handleSaveReport()}>
          <span className="btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </span> 新しいレポートを保存
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

      <button className="fab ripple" aria-label="共有する" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      </button>
    </>
  )
}
