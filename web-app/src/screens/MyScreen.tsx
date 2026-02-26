import { useEffect, useState } from 'react'
import DateNavBar from '../components/DateNavBar'
import { fetchConnectionStatus } from '../api/healthApi'
import type { ConnectionStatusResponse, RequestState } from '../api/types'

function toLocalString(value: string | null): string {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ja-JP')
}

function statusPill(ok: boolean) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        color: ok ? '#1b5e20' : '#8e2424',
        background: ok ? '#c8e6c9' : '#ffcdd2',
      }}
    >
      {ok ? 'OK' : '未取得'}
    </span>
  )
}

export default function MyScreen() {
  const [state, setState] = useState<RequestState<ConnectionStatusResponse>>({ status: 'loading' })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await fetchConnectionStatus()
        if (mounted) {
          setState({ status: 'success', data })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (mounted) {
          setState({ status: 'error', error: message })
        }
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div>
      <DateNavBar />
      <div style={{ padding: '16px 16px 28px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>接続ステータス</h3>
        {state.status === 'loading' ? <p style={{ color: 'var(--text-secondary)' }}>読み込み中...</p> : null}
        {state.status === 'error' ? <p style={{ color: '#b91c1c' }}>{state.error}</p> : null}
        {state.status === 'success' ? (
          <div style={{ marginTop: '10px', display: 'grid', gap: '12px' }}>
            <section style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div>最終同期: {toLocalString(state.data.last_sync_at)}</div>
                <div>総レコード数: {state.data.total_records.toLocaleString('ja-JP')}</div>
              </div>
            </section>

            <section style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>体重データ</span>
                  {statusPill(state.data.has_weight_data)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>睡眠データ</span>
                  {statusPill(state.data.has_sleep_data)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>活動データ</span>
                  {statusPill(state.data.has_activity_data)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>バイタルデータ</span>
                  {statusPill(state.data.has_vitals_data)}
                </div>
              </div>
            </section>

            {state.data.health_connect_permissions ? (
              <section style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Health Connect 権限
                </h4>
                <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div>ソース: {state.data.health_connect_permissions.source}</div>
                  <div>
                    付与: {state.data.health_connect_permissions.granted_count} / {state.data.health_connect_permissions.required_count}
                  </div>
                  <div>
                    状態: {state.data.health_connect_permissions.is_fully_granted ? 'すべて付与済み' : '不足あり'}
                  </div>
                  {state.data.health_connect_permissions.missing.length > 0 ? (
                    <div>
                      不足権限:
                      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                        {state.data.health_connect_permissions.missing.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
