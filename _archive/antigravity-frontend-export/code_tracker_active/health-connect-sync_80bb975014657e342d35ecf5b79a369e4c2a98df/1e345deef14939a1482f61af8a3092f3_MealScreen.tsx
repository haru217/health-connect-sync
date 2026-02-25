�Fimport { useState } from 'react';
import './MealScreen.css';

type TabType = 'log' | 'supplement' | 'nutrition';
type TimingType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface MealItem {
    id: string;
    timing: TimingType;
    name: string;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
}

interface SupplItem {
    id: string;
    name: string;
    checked: boolean;
}

const MOCK_MEALS: MealItem[] = [
    { id: '1', timing: 'breakfast', name: 'トーストと目玉焼き', kcal: 320, protein: 12, fat: 15, carbs: 35 },
    { id: '2', timing: 'lunch', name: '鶏肉のサラダボウル', kcal: 450, protein: 35, fat: 18, carbs: 20 },
    { id: '3', timing: 'snack', name: 'プロテインドリンク', kcal: 120, protein: 20, fat: 1, carbs: 5 },
];

const MOCK_SUPPLS: SupplItem[] = [
    { id: '1', name: 'マルチビタミン', checked: true },
    { id: '2', name: '亜鉛 & マカ', checked: false },
    { id: '3', name: 'ビタミンC', checked: true },
];

export default function MealScreen() {
    const [activeTab, setActiveTab] = useState<TabType>('log');
    const [date] = useState('2026-02-22 (日)');
    const [meals, setMeals] = useState<MealItem[]>(MOCK_MEALS);
    const [suppls, setSuppls] = useState<SupplItem[]>(MOCK_SUPPLS);

    const getTimingLabel = (t: TimingType) => {
        switch (t) {
            case 'breakfast': return '朝食';
            case 'lunch': return '昼食';
            case 'dinner': return '夕食';
            case 'snack': return '間食';
        }
    };

    const getMealsByTiming = (timing: TimingType) => meals.filter(m => m.timing === timing);

    const deleteMeal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMeals(meals.filter(m => m.id !== id));
    };

    const toggleSuppl = (id: string) => {
        setSuppls(suppls.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
    };

    return (
        <>
            <div className="meal-container fade-in">
                <div className="date-selector sticky-header">
                    <button className="icon-btn ripple">‹</button>
                    <div className="current-date">{date}</div>
                    <button className="icon-btn ripple">›</button>
                </div>

                <div className="tab-row">
                    <div className={`tab-btn ripple ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>食事ログ</div>
                    <div className={`tab-btn ripple ${activeTab === 'supplement' ? 'active' : ''}`} onClick={() => setActiveTab('supplement')}>サプリ</div>
                    <div className={`tab-btn ripple ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>栄養素</div>
                </div>

                <div className="tab-content">
                    {activeTab === 'log' && (
                        <div className="meal-log-list fade-in">
                            {meals.length === 0 ? (
                                <div className="empty-state stagger-1">
                                    <div className="empty-state-icon">🍽️</div>
                                    <div className="empty-state-title">まだ食事がありません</div>
                                    <p>右下の＋ボタンから今日の食事を追加しましょう。</p>
                                </div>
                            ) : (
                                (['breakfast', 'lunch', 'dinner', 'snack'] as TimingType[]).map((timing, groupIndex) => {
                                    const timingMeals = getMealsByTiming(timing);
                                    if (timingMeals.length === 0) return null;
                                    return (
                                        <div key={timing} className={`meal-group stagger-${Math.min(groupIndex + 1, 5)}`}>
                                            <div className="meal-group-header">{getTimingLabel(timing)}</div>
                                            {timingMeals.map((meal) => (
                                                <div key={meal.id} className="meal-item card ripple">
                                                    <div className="meal-item-main">
                                                        <div className="meal-item-name">{meal.name}</div>
                                                        <div className="meal-item-kcal num">{meal.kcal} <span className="unit">kcal</span></div>
                                                    </div>
                                                    <div className="meal-item-macros num">
                                                        P: {meal.protein}g / F: {meal.fat}g / C: {meal.carbs}g
                                                    </div>
                                                    <button className="delete-btn ripple" onClick={(e) => deleteMeal(meal.id, e)}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'supplement' && (
                        <div className="suppl-list fade-in">
                            {suppls.length === 0 ? (
                                <div className="empty-state stagger-1">
                                    <div className="empty-state-icon">💊</div>
                                    <div className="empty-state-title">サプリが未登録です</div>
                                    <p>右下の＋ボタンから飲んでいるサプリを登録しましょう。</p>
                                </div>
                            ) : (
                                suppls.map((suppl, idx) => (
                                    <div
                                        key={suppl.id}
                                        className={`suppl-item card ripple stagger-${Math.min(idx + 1, 5)} ${suppl.checked ? 'checked' : ''}`}
                                        onClick={() => toggleSuppl(suppl.id)}
                                    >
                                        <div className="suppl-item-name">{suppl.name}</div>
                                        <div className="suppl-item-check">
                                            {suppl.checked ? '✅' : '⬜'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'nutrition' && (
                        <div className="nutrition-list fade-in">
                            <div className="stagger-1"><NutritionBar label="カロリー" current={890} target={1800} unit="kcal" /></div>
                            <div className="stagger-2"><NutritionBar label="タンパク質" current={57} target={90} unit="g" /></div>
                            <div className="stagger-3"><NutritionBar label="脂質" current={34} target={55} unit="g" /></div>
                            <div className="stagger-4"><NutritionBar label="炭水化物" current={80} target={220} unit="g" /></div>
                        </div>
                    )}
                </div>
            </div>

            {/* FAB placed outside the fade-in container */}
            {activeTab === 'log' && <button className="fab ripple" aria-label="食事を追加">＋</button>}
            {activeTab === 'supplement' && <button className="fab ripple" aria-label="サプリを追加">＋</button>}
        </>
    );
}

function NutritionBar({ label, current, target, unit }: { label: string, current: number, target: number, unit: string }) {
    const percent = Math.min(100, (current / target) * 100);
    let colorVar = '--accent-color';
    if (percent > 110) colorVar = '--danger-color';
    else if (percent > 90) colorVar = '--good-color';

    return (
        <div className="nutrition-bar-container card">
            <div className="nutrition-bar-header">
                <span className="nutrition-bar-label">{label}</span>
                <span className="nutrition-bar-values num">
                    <span className="current">{current}</span> / {target} <span className="unit">{unit}</span>
                </span>
            </div>
            <div className="progress-bg">
                <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: `var(${colorVar})` }}></div>
            </div>
        </div>
    );
}
�F"(80bb975014657e342d35ecf5b79a369e4c2a98df2Lfile:///C:/Users/user/health-connect-sync/web-app/src/screens/MealScreen.tsx:)file:///C:/Users/user/health-connect-sync