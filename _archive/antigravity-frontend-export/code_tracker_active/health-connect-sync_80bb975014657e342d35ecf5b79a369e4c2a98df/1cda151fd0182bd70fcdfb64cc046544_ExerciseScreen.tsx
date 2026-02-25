�-import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './ExerciseScreen.css';

type PeriodType = 'weekly' | 'monthly';

const weeklyStepData = [
    { day: '月', steps: 5200 },
    { day: '火', steps: 7800 },
    { day: '水', steps: 3400 },
    { day: '木', steps: 8900 },
    { day: '金', steps: 6100 },
    { day: '土', steps: 10200 },
    { day: '日', steps: 8500 },
];

const weeklyCalorieData = [
    { day: '月', kcal: 2100 },
    { day: '火', kcal: 2450 },
    { day: '水', kcal: 1800 },
    { day: '木', kcal: 2600 },
    { day: '金', kcal: 2200 },
    { day: '土', kcal: 2900 },
    { day: '日', kcal: 2550 },
];

export default function ExerciseScreen() {
    const [period, setPeriod] = useState<PeriodType>('weekly');

    return (
        <>
            <div className="exercise-container fade-in">
                <div className="segment-control">
                    <div
                        className={`segment-btn ripple ${period === 'weekly' ? 'active' : ''}`}
                        onClick={() => setPeriod('weekly')}
                    >週間</div>
                    <div
                        className={`segment-btn ripple ${period === 'monthly' ? 'active' : ''}`}
                        onClick={() => setPeriod('monthly')}
                    >月間</div>
                </div>

                <div className="summary-section">
                    <h3 className="section-title">サマリー</h3>
                    <div className="summary-grid">
                        <div className="summary-card card ripple stagger-1">
                            <div className="summary-label">平均歩数</div>
                            <div className="summary-value num">7,240 <span className="unit">歩</span></div>
                        </div>
                        <div className="summary-card card ripple stagger-2">
                            <div className="summary-label">合計距離</div>
                            <div className="summary-value num">35.2 <span className="unit">km</span></div>
                        </div>
                        <div className="summary-card card ripple stagger-3">
                            <div className="summary-label">消費カロリー</div>
                            <div className="summary-value num">2,850 <span className="unit">kcal</span></div>
                        </div>
                    </div>
                </div>

                <div className="chart-section">
                    <h3 className="section-title">アクティビティ推移</h3>

                    <div className="chart-card card stagger-4">
                        <div className="chart-header">歩数（{period === 'weekly' ? '過去7日間' : '過去30日間'}）</div>
                        <div className="rechart-container" style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyStepData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(136, 212, 180, 0.1)' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="steps" fill="var(--accent-color)" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="chart-card card stagger-5">
                        <div className="chart-header">消費カロリー</div>
                        <div className="rechart-container" style={{ width: '100%', height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weeklyCalorieData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8F2ED" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8FA39A' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="kcal" stroke="var(--warning-color)" strokeWidth={3} dot={{ r: 4, fill: 'var(--warning-color)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAB placed outside the fade-in container */}
            <button className="fab ripple" aria-label="運動を追加">＋</button>
        </>
    );
}
�-"(80bb975014657e342d35ecf5b79a369e4c2a98df2Pfile:///C:/Users/user/health-connect-sync/web-app/src/screens/ExerciseScreen.tsx:)file:///C:/Users/user/health-connect-sync