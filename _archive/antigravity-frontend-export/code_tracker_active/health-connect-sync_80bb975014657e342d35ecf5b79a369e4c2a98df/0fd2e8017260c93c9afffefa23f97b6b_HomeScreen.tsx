�import './HomeScreen.css';

export default function HomeScreen() {
    return (
        <div className="home-container fade-in">
            {/* AI Character Section - Sticky */}
            <div className="ai-character-section card sticky-ai">
                <div className="ai-avatar ripple">
                    <span role="img" aria-label="advisor" className="ai-emoji">👩‍⚕️</span>
                </div>
                <div className="ai-message">
                    <p className="greeting">こんにちは、ハルさん！✨</p>
                    <p className="insight">良いペースで消費が進んでいます。午後は少し水分を多めに摂りましょう！</p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="metrics-grid">
                {/* Weight Card */}
                <div className="metric-card card ripple stagger-1">
                    <div className="metric-header">
                        <span className="metric-icon">⚖️</span>
                        <span className="metric-title">体重</span>
                    </div>
                    <div className="metric-value num">53.2 <span className="metric-unit">kg</span></div>
                    <div className="metric-trend good">
                        <span className="trend-arrow">↘</span> 0.3 kg / 7d
                    </div>
                </div>

                {/* Steps Card */}
                <div className="metric-card card ripple stagger-2">
                    <div className="metric-header">
                        <span className="metric-icon">👟</span>
                        <span className="metric-title">歩数</span>
                    </div>
                    <div className="metric-value num">6,500 <span className="metric-unit">歩</span></div>
                    <div className="metric-trend good">
                        <span className="trend-arrow">↗</span> 7.2k / 7d
                    </div>
                </div>

                {/* Sleep Card */}
                <div className="metric-card card ripple stagger-3">
                    <div className="metric-header">
                        <span className="metric-icon">🌙</span>
                        <span className="metric-title">睡眠</span>
                    </div>
                    <div className="metric-value num">6.5 <span className="metric-unit">h</span></div>
                    <div className="metric-trend warning">
                        <span className="trend-arrow">↘</span> 少なめ
                    </div>
                </div>

                {/* Calorie Card */}
                <div className="metric-card card ripple stagger-4">
                    <div className="metric-header">
                        <span className="metric-icon">🔥</span>
                        <span className="metric-title">収支</span>
                    </div>
                    <div className="metric-value num">-50 <span className="metric-unit">kcal</span></div>
                    <div className="metric-trend good">
                        <span className="trend-arrow">✓</span> 適正
                    </div>
                </div>
            </div>
        </div>
    );
}
�"(80bb975014657e342d35ecf5b79a369e4c2a98df2Lfile:///C:/Users/user/health-connect-sync/web-app/src/screens/HomeScreen.tsx:)file:///C:/Users/user/health-connect-sync