import ExpertCard, { type ExpertConfigItem } from './ExpertCard'

type Props = {
  comment: string | null
  loading: boolean
  expert: ExpertConfigItem
}

export default function TabAiAdvice({ comment, loading, expert }: Props) {
  if (loading || !comment) return null
  return (
    <section
      className="expert-section"
      style={{
        borderTop: '1px solid var(--border-color)',
        marginTop: 16,
        paddingTop: 16,
      }}
    >
      <div className="expert-section-header">
        <div className="expert-section-title">
          <span>AIアドバイス</span>
        </div>
      </div>
      <div className="expert-cards-list">
        <ExpertCard {...expert} content={comment} />
      </div>
    </section>
  )
}
