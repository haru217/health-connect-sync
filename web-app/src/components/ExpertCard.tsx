/* eslint-disable react-refresh/only-export-components */

export type ExpertTag = 'doctor' | 'nutritionist' | 'trainer'

export type ExpertConfigItem = {
  tag: ExpertTag
  name: string
  role: string
  avatar: string
  alt: string
  borderColor: string
  gradientFrom: string
  gradientTo: string
  hasDecoration?: boolean
}

export const EXPERT_CONFIG: ReadonlyArray<ExpertConfigItem> = [
  {
    tag: 'doctor',
    name: 'ユウ先生',
    role: '総合分析アドバイス',
    avatar: '/avatars/avatar-yu.png',
    alt: '医師 ユウ',
    borderColor: 'var(--accent-indigo)',
    gradientFrom: '#c7d2fe',
    gradientTo: '#a5b4fc',
    hasDecoration: true,
  },
  {
    tag: 'nutritionist',
    name: 'サキさん',
    role: '栄養バランス',
    avatar: '/avatars/avatar-saki.png',
    alt: '管理栄養士 サキ',
    borderColor: 'var(--accent-color)',
    gradientFrom: '#bbf7d0',
    gradientTo: '#99f6e4',
  },
  {
    tag: 'trainer',
    name: 'マイコーチ',
    role: 'アクティビティ',
    avatar: '/avatars/avatar-mai.png',
    alt: 'トレーナー マイ',
    borderColor: '#ed8936',
    gradientFrom: '#fed7aa',
    gradientTo: '#fecaca',
  },
]

type ExpertCardProps = {
  tag?: ExpertTag
  name: string
  role: string
  avatar: string
  alt: string
  borderColor: string
  gradientFrom: string
  gradientTo: string
  content: string
  hasDecoration?: boolean
}

export function getExpertByTag(tag: ExpertTag): ExpertConfigItem {
  const found = EXPERT_CONFIG.find((c) => c.tag === tag)
  if (!found) throw new Error(`Unknown expert tag: ${tag}`)
  return found
}

export default function ExpertCard({
  name,
  role,
  avatar,
  alt,
  borderColor,
  gradientFrom,
  gradientTo,
  content,
  hasDecoration,
}: ExpertCardProps) {
  return (
    <div className="expert-card" style={{ borderLeftColor: borderColor }}>
      {hasDecoration ? <div className="expert-card-decor"></div> : null}
      <div className="expert-card-inner">
        <div className="expert-avatar-wrapper">
          <div
            className="expert-avatar-ring"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            <img src={avatar} alt={alt} className="expert-avatar-icon" />
          </div>
          <span className="expert-name-badge" style={{ color: borderColor }}>{name}</span>
        </div>
        <div className="expert-text">
          <span className="expert-role" style={{ color: borderColor }}>{role}</span>
          <p className="expert-body">{content}</p>
        </div>
      </div>
    </div>
  )
}
