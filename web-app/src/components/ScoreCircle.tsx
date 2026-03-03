import './ScoreCircle.css'

interface ScoreCircleProps {
    score: number
    color: 'green' | 'yellow' | 'red' | string
    label?: string
    size?: 'hero' | 'large' | 'small'
    showValue?: boolean
    icon?: React.ReactNode
}

export default function ScoreCircle({ score, color, label, size = 'small', showValue = true, icon }: ScoreCircleProps) {
    const isHero = size === 'hero'
    const isLarge = size === 'large' || isHero
    const radius = isHero ? 42 : isLarge ? 54 : 20
    const strokeWidth = isHero ? 8 : isLarge ? 10 : 5
    const viewBoxSize = isHero ? 100 : isLarge ? 128 : 48
    const center = viewBoxSize / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference

    let colorCode = 'var(--accent-color)'
    let trailColorCode = 'rgba(255, 255, 255, 0.08)'

    if (color === 'red') {
        colorCode = 'var(--danger-color)'
    } else if (color === 'yellow') {
        colorCode = 'var(--warning-color)'
    } else if (color === 'green') {
        colorCode = 'var(--accent-color)'
    } else {
        colorCode = color // 任意のCSS変数またはカラーコード
    }

    return (
        <div className={`score-circle-container ${size}`}>
            <svg width={viewBoxSize} height={viewBoxSize} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="score-circle-svg">
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={trailColorCode}
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={colorCode}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="score-circle-path"
                    transform={`rotate(-90 ${center} ${center})`}
                />
            </svg>
            <div className="score-circle-content">
                {icon ? (
                    <div className="score-circle-icon">{icon}</div>
                ) : showValue ? (
                    <>
                        <div className="score-circle-value" style={{ color: colorCode }}>{score}</div>
                        {isLarge && !isHero && <div className="score-circle-scale">/100</div>}
                    </>
                ) : null}
            </div>
            {label && <div className="score-circle-label">{label}</div>}
        </div>
    )
}
