import DateNavBar from '../components/DateNavBar'

export default function MyScreen() {
  return (
    <div>
      <DateNavBar />
      <div style={{ padding: '24px', color: 'var(--text-secondary)', textAlign: 'center' }}>
        <p>マイページ</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>（Coming soon）</p>
      </div>
    </div>
  )
}
