import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDateContext } from '../context/DateContext'
import DateNavBar from '../components/DateNavBar'
import FoodInput from '../components/FoodInput'
import FoodConfirm from '../components/FoodConfirm'
import FoodEditModal from '../components/FoodEditModal'
import { fetchFoodHistory, deleteFood, updateFood } from '../api/food'
import { fetchSupplements, fetchNutritionDay, logNutrition, deleteNutritionLog } from '../api/healthApi'
import { MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../constants/food'
import type { FoodAnalyzeResponse, FoodHistoryResponse, FoodHistoryItem, SupplementItem, NutritionDayResponse } from '../api/types'

interface SupplementView {
    alias: string
    name: string
    checked: boolean
    count: number
    eventIds: number[]
    unitLabel: string
}

function toSupplementViews(supplements: SupplementItem[], day: NutritionDayResponse): SupplementView[] {
    return supplements.map((item) => {
        const aliasEvents = day.events.filter((e) => e.alias === item.alias)
        const sumCount = aliasEvents.reduce((sum, e) => sum + (e.count ?? 0), 0)
        return {
            alias: item.alias,
            name: item.label,
            checked: aliasEvents.length > 0,
            count: Math.max(1, Math.round(sumCount)) || 1,
            eventIds: aliasEvents.map((e) => e.id),
            unitLabel: item.alias === 'protein' ? '本' : '錠',
        }
    })
}

export default function FoodScreen() {
    const { activeDate } = useDateContext()
    const [view, setView] = useState<'home' | 'input' | 'confirm'>('home')
    const [historyData, setHistoryData] = useState<FoodHistoryResponse | null>(null)
    const [analyzeData, setAnalyzeData] = useState<FoodAnalyzeResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [supplements, setSupplements] = useState<SupplementView[]>([])
    const [supplementError, setSupplementError] = useState<string | null>(null)

    // Edit Modal States
    const [editingItem, setEditingItem] = useState<FoodHistoryItem | null>(null)
    const [editLoading, setEditLoading] = useState(false)

    const loadHistory = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const data = await fetchFoodHistory(activeDate)
            setHistoryData(data)
        } catch {
            setLoadError('食事履歴の取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }, [activeDate])

    const loadSupplements = useCallback(async () => {
        try {
            const [supplementRes, day] = await Promise.all([
                fetchSupplements(),
                fetchNutritionDay(activeDate),
            ])
            setSupplements(toSupplementViews(supplementRes.supplements, day))
        } catch {
            // サプリ読み込みはサイレント失敗
        }
    }, [activeDate])

    useEffect(() => {
        loadHistory()
        loadSupplements()
    }, [activeDate, loadHistory, loadSupplements])

    const clearSupplementLogs = useCallback(async (item: SupplementView) => {
        if (item.eventIds.length === 0) return
        await Promise.all(item.eventIds.map((id) => deleteNutritionLog(id)))
    }, [])

    const saveSupplementCount = useCallback(async (item: SupplementView, count: number) => {
        await clearSupplementLogs(item)
        await logNutrition({ alias: item.alias, count: Math.max(1, count), local_date: activeDate })
    }, [clearSupplementLogs, activeDate])

    const toggleSupplement = async (item: SupplementView) => {
        setSupplementError(null)
        try {
            if (item.checked) {
                await clearSupplementLogs(item)
            } else {
                await saveSupplementCount(item, 1)
            }
            await loadSupplements()
        } catch {
            setSupplementError('サプリ更新エラー')
        }
    }

    const adjustSupplementCount = async (item: SupplementView, delta: number) => {
        setSupplementError(null)
        const next = Math.max(1, item.count + delta)
        if (next === item.count) return
        try {
            await saveSupplementCount(item, next)
            await loadSupplements()
        } catch {
            setSupplementError('サプリ更新エラー')
        }
    }

    const handleItemClick = (item: FoodHistoryItem) => {
        setEditingItem(item)
    }

    const handleEditSave = async (data: {
        name: string
        amount: string
        kcal: number
        protein_g: number
        fat_g: number
        carbs_g: number
        meal_type: string | null
    }) => {
        if (!editingItem) return
        setEditLoading(true)
        try {
            await updateFood(editingItem.id, data)
            setEditingItem(null)
            await loadHistory()
        } catch {
            setLoadError('保存に失敗しました')
        } finally {
            setEditLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!editingItem) return
        setEditLoading(true)
        try {
            await deleteFood(editingItem.id)
            setEditingItem(null)
            await loadHistory()
        } catch {
            setLoadError('削除に失敗しました')
        } finally {
            setEditLoading(false)
        }
    }

    const { items = [], summary } = historyData || {}

    const groupedItems = useMemo(() => {
        if (!items || items.length === 0) return []
        const groups: Array<{ type: string | null; label: string; items: typeof items }> = []
        for (const mealType of MEAL_TYPE_ORDER) {
            const filtered = items.filter((item) => (item.mealType ?? null) === mealType)
            if (filtered.length > 0) {
                groups.push({
                    type: mealType,
                    label: mealType ? MEAL_TYPE_LABELS[mealType] : 'その他',
                    items: filtered,
                })
            }
        }
        return groups
    }, [items])

    if (view === 'input') {
        return (
            <div className="screen-container">
                <FoodInput
                    onAnalyzeSuccess={(data) => {
                        setAnalyzeData(data)
                        setView('confirm')
                    }}
                    onCancel={() => setView('home')}
                />
            </div>
        )
    }

    if (view === 'confirm' && analyzeData) {
        return (
            <div className="screen-container">
                <FoodConfirm
                    analyzeData={analyzeData}
                    onConfirmSuccess={() => {
                        setView('home')
                        loadHistory()
                    }}
                    onBack={() => setView('input')}
                />
            </div>
        )
    }

    return (
        <div className="home-container">
            <DateNavBar />

            <div style={{ padding: '16px', paddingBottom: '100px' }}>
                {loadError && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--danger-bg, #fef2f2)', color: 'var(--danger-color, #dc2626)', borderRadius: '8px', fontSize: '13px' }}>
                        {loadError}
                    </div>
                )}
                {/* サマリーセクション */}
                <section style={{ background: 'var(--surface)', padding: '16px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '12px' }}>今日のサマリー</h2>
                    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '16px' }}>
                        <span style={{ fontSize: '32px', fontWeight: 'bold' }}>{summary?.calories?.toFixed(0) || '0'}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '4px' }}>kcal</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {(['protein_g', 'fat_g', 'carbs_g'] as const).map(key => (
                            <div key={key} style={{ background: 'var(--bg-color)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {key === 'protein_g' ? 'タンパク質' : key === 'fat_g' ? '脂質' : '炭水化物'}
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    {summary?.[key]?.toFixed(1) || '0.0'}g
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 記録ボタン */}
                <button
                    onClick={() => setView('input')}
                    style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '16px', border: 'none', fontSize: '16px', fontWeight: 'bold', marginBottom: '24px', boxShadow: '0 4px 12px var(--shadow-color)' }}
                >
                    ＋ 食事を記録
                </button>

                {/* 食事リスト */}
                <section>
                    <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>記録済みの食事</h3>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>読み込み中...</div>
                    ) : groupedItems.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {groupedItems.map(group => (
                                <div key={group.type || 'other'}>
                                    <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>{group.label}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {group.items.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleItemClick(item)}
                                                style={{ background: 'var(--surface)', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.name}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{item.nutrients.calories?.toFixed(0) || '0'} kcal</div>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>chevron_right</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.amount}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '32px', background: 'var(--surface)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            まだ記録がありません。
                        </div>
                    )}
                </section>

                {/* サプリセクション */}
                <section style={{ marginTop: '24px' }}>
                    <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>サプリメント</h3>
                    {supplementError && (
                        <div style={{ marginBottom: '8px', color: 'var(--danger-color, #dc2626)', fontSize: '13px' }}>{supplementError}</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {supplements.map((item) => (
                            <div
                                key={item.alias}
                                onClick={() => void toggleSupplement(item)}
                                style={{
                                    background: item.checked ? 'var(--accent-bg, #eff6ff)' : 'var(--surface)',
                                    border: `1.5px solid ${item.checked ? 'var(--accent-color)' : 'var(--border-color, #e5e7eb)'}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                <SupplementIcon alias={item.alias} checked={item.checked} />
                                <div style={{ flex: 1, fontSize: '15px', fontWeight: item.checked ? 'bold' : 'normal' }}>{item.name}</div>
                                {item.checked ? (
                                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            onClick={() => void adjustSupplementCount(item, -1)}
                                            disabled={item.count <= 1}
                                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid var(--accent-color)', background: 'white', color: 'var(--accent-color)', fontSize: '18px', lineHeight: 1, cursor: item.count <= 1 ? 'not-allowed' : 'pointer', opacity: item.count <= 1 ? 0.4 : 1 }}
                                        >−</button>
                                        <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 'bold' }}>
                                            {item.count}<span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '2px' }}>{item.unitLabel}</span>
                                        </span>
                                        <button
                                            onClick={() => void adjustSupplementCount(item, 1)}
                                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid var(--accent-color)', background: 'white', color: 'var(--accent-color)', fontSize: '18px', lineHeight: 1, cursor: 'pointer' }}
                                        >＋</button>
                                    </div>
                                ) : (
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid var(--border-color, #d1d5db)', flexShrink: 0 }} />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Edit Modal */}
            {editingItem && (
                <FoodEditModal
                    item={editingItem}
                    editLoading={editLoading}
                    onSave={handleEditSave}
                    onDelete={handleDelete}
                    onClose={() => setEditingItem(null)}
                />
            )}
        </div>
    )
}

function SupplementIcon({ alias, checked }: { alias: string; checked: boolean }) {
    const color = checked ? 'var(--accent-color)' : 'var(--text-muted, #9ca3af)'
    let d: React.ReactNode
    switch (alias) {
        case 'protein':
            d = <><path d="M6 6h12l-1 14H7L6 6z" /><path d="M8 2h8v4H8z" /><path d="M10 10h4M10 14h4" /></>
            break
        case 'vitamin_d':
            d = <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>
            break
        case 'fish_oil':
            d = <><path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" /><path d="M14 7a5 5 0 00-6 3" /></>
            break
        case 'multivitamin':
            d = <><circle cx="12" cy="12" r="10" /><path d="M12 6v12M8 10l8 4M8 14l8-4" /></>
            break
        default:
            d = <><rect x="7" y="3" width="10" height="18" rx="5" /><path d="M7 12h10" /></>
    }
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            {d}
        </svg>
    )
}
