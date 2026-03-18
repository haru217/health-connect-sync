import { useState, useEffect, useRef } from 'react'
import type { FoodAnalyzeResponse, FoodAnalyzeResult } from '../api/types'
import NutrientTable from './NutrientTable'
import { confirmFood, searchFoodFavorites } from '../api/food'
import { useDateContext } from '../context/DateContext'
import { MEAL_TYPES, suggestMealType } from '../constants/food'

interface FoodConfirmProps {
    analyzeData: FoodAnalyzeResponse
    onConfirmSuccess: () => void
    onBack: () => void
}

type ConfirmItem = FoodAnalyzeResult & {
    save_to_favorites?: boolean
    meal_type?: string
    multiplier?: number
    base_item?: FoodAnalyzeResult
    from_favorite?: boolean
}

function isReasonableMatch(queryName: string, resultName: string): boolean {
    const q = queryName.replace(/\s+/g, '')
    const r = resultName.replace(/\s+/g, '')
    if (q.length === 0 || r.length === 0) return false
    // 結果名がクエリ名を含む場合は良いマッチ（例: "味噌汁" → "味噌汁（ねぎ・わかめ）"）
    if (r.includes(q)) return true
    // 長さの比率が0.4未満なら不一致とみなす
    const ratio = Math.min(q.length, r.length) / Math.max(q.length, r.length)
    return ratio >= 0.4
}

export default function FoodConfirm({ analyzeData, onConfirmSuccess, onBack }: FoodConfirmProps) {
    const { activeDate } = useDateContext()
    const [items, setItems] = useState<ConfirmItem[]>(
        analyzeData.items.map(item => ({ ...item, save_to_favorites: true, meal_type: suggestMealType(), multiplier: 1, base_item: structuredClone(item) }))
    )
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [suggestions, setSuggestions] = useState<FoodAnalyzeResult[]>([])
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 初期表示時：各品目をお気に入りDBと突合
    useEffect(() => {
        const matchAll = async () => {
            const results = await Promise.all(
                analyzeData.items.map(async (item) => {
                    try {
                        const favs = await searchFoodFavorites(item.name)
                        if (favs.length > 0 && isReasonableMatch(item.name, favs[0].name)) {
                            return favs[0]
                        }
                    } catch { /* non-critical */ }
                    return null
                })
            )
            setItems(prev => prev.map((item, i) => {
                const match = results[i]
                if (!match) return item
                const merged: ConfirmItem = {
                    ...item,
                    name: match.name,
                    brand: match.brand,
                    amount: match.amount,
                    nutrients: { ...match.nutrients },
                    from_favorite: true,
                    save_to_favorites: true,
                }
                merged.base_item = structuredClone(merged)
                merged.multiplier = 1
                return merged
            }))
        }
        matchAll()
    }, [analyzeData.items])

    const deleteItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    const startEditing = (index: number) => {
        setEditingIndex(index)
        setEditName(items[index].name)
        setSuggestions([])
    }

    const handleNameChange = (value: string) => {
        setEditName(value)
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
        if (!value.trim()) {
            setSuggestions([])
            return
        }
        searchTimerRef.current = setTimeout(async () => {
            try {
                const favs = await searchFoodFavorites(value.trim())
                setSuggestions(favs)
            } catch {
                setSuggestions([])
            }
        }, 300)
    }

    const applyFavorite = (index: number, fav: FoodAnalyzeResult) => {
        setItems(prev => prev.map((it, i) => {
            if (i !== index) return it
            const updated: ConfirmItem = {
                ...it,
                name: fav.name,
                brand: fav.brand,
                amount: fav.amount,
                nutrients: { ...fav.nutrients },
                from_favorite: true,
                save_to_favorites: true,
            }
            updated.base_item = structuredClone(updated)
            updated.multiplier = 1
            return updated
        }))
        setEditingIndex(null)
        setSuggestions([])
    }

    const confirmNameEdit = (index: number) => {
        if (editName.trim() && editName !== items[index].name) {
            setItems(prev => prev.map((it, i) => i === index ? { ...it, name: editName.trim() } : it))
        }
        setEditingIndex(null)
        setSuggestions([])
    }

    const updateItemMultiplier = (index: number, newMultiplier: number) => {
        setItems(prev => prev.map((it, i) => {
            if (i !== index) return it;
            const base = it.base_item;
            if (!base) return { ...it, multiplier: newMultiplier };

            // 再計算（イミュータブル）
            const recalcNutrients = Object.fromEntries(
                Object.entries(base.nutrients).map(([k, v]) => [
                    k,
                    typeof v === 'number' ? Number((v * newMultiplier).toFixed(1)) : v,
                ])
            ) as typeof base.nutrients;

            return {
                ...it,
                multiplier: newMultiplier,
                nutrients: recalcNutrients
            };
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setError(null)
        try {
            // base_item 等の不要な拡張プロパティを除外して純粋なアイテムだけを渡す
            const payloadItems = items.map(({ base_item, multiplier, from_favorite, ...rest }) => rest)
            await confirmFood(payloadItems, activeDate, new Date().toISOString())
            setShowSuccess(true)
            setTimeout(() => onConfirmSuccess(), 1000)
        } catch (err) {
            setError('保存に失敗しました。もう一度お試しください。')
            setLoading(false)
        }
    }

    if (showSuccess) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
                <div style={{ fontSize: '48px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>記録を保存しました</div>
            </div>
        )
    }

    if (!items || items.length === 0) {
        return (
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>すべての品目を削除しました</p>
                <button onClick={onBack} style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold' }}>
                    再入力
                </button>
            </div>
        )
    }

    return (
        <div className="food-confirm-container" style={{ padding: '16px', background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', marginRight: '16px' }}>←</button>
                <div>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>分析結果</h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{items.length}品目</div>
                </div>
            </div>

            {error && <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {items.map((item, index) => (
                    <div key={index} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
                        {/* 削除ボタン */}
                        <button
                            onClick={() => deleteItem(index)}
                            style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            aria-label="この品目を削除"
                        >✕</button>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', paddingRight: '32px' }}>
                            {MEAL_TYPES.map(mt => (
                                <button key={mt.value}
                                    onClick={() => setItems(prev => prev.map((it, i) => i === index ? { ...it, meal_type: mt.value } : it))}
                                    style={{
                                        flex: 1, padding: '8px 4px', borderRadius: '8px',
                                        background: item.meal_type === mt.value ? 'var(--accent-color)' : 'var(--bg-color)',
                                        color: item.meal_type === mt.value ? 'white' : 'var(--text-muted)',
                                        border: item.meal_type === mt.value ? 'none' : '1px solid var(--border-color)',
                                        fontSize: '12px', cursor: 'pointer', fontWeight: item.meal_type === mt.value ? 'bold' : 'normal',
                                    }}>
                                    {mt.emoji} {mt.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(item.brand && item.brand !== 'null') ? item.brand : '一般'}</div>
                                {item.from_favorite ? (
                                    <span style={{ fontSize: '11px', background: 'var(--accent-color)', color: 'white', padding: '1px 6px', borderRadius: '4px' }}>お気に入り</span>
                                ) : null}
                            </div>
                            {editingIndex === index ? (
                                <div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => handleNameChange(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') confirmNameEdit(index) }}
                                            autoFocus
                                            style={{ flex: 1, fontSize: '18px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--accent-color)', outline: 'none' }}
                                        />
                                        <button
                                            onClick={() => confirmNameEdit(index)}
                                            style={{ padding: '4px 12px', borderRadius: '8px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '13px', cursor: 'pointer' }}
                                        >確定</button>
                                    </div>
                                    {suggestions.length > 0 ? (
                                        <div style={{ marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                                            {suggestions.slice(0, 5).map((fav, si) => (
                                                <button
                                                    key={fav.id || si}
                                                    onClick={() => applyFavorite(index, fav)}
                                                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'var(--surface)', border: 'none', borderBottom: si < Math.min(suggestions.length, 5) - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', fontSize: '14px' }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <span style={{ fontWeight: 'bold' }}>{fav.name}</span>
                                                            <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>{fav.amount}</span>
                                                        </div>
                                                        <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '13px' }}>
                                                            {fav.nutrients.calories?.toFixed(0) || '?'} kcal
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div
                                    onClick={() => startEditing(index)}
                                    style={{ fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {item.name}
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>✎</span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>分量目安:</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={item.amount}
                                    onChange={e => {
                                        setItems(prev => prev.map((it, i) => i === index ? { ...it, amount: e.target.value } : it))
                                    }}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: 0 }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                    <button
                                        onClick={() => {
                                            const newMult = Math.max(0.25, (item.multiplier || 1) - 0.5);
                                            updateItemMultiplier(index, newMult);
                                        }}
                                        style={{ width: '36px', height: '36px', background: 'none', border: 'none', borderRight: '1px solid var(--border-color)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                                    >-</button>
                                    <div style={{ padding: '0 12px', fontSize: '14px', fontWeight: 'bold', minWidth: '40px', textAlign: 'center' }}>
                                        {item.multiplier || 1}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newMult = Math.min(10, (item.multiplier || 1) + 0.5);
                                            updateItemMultiplier(index, newMult);
                                        }}
                                        style={{ width: '36px', height: '36px', background: 'none', border: 'none', borderLeft: '1px solid var(--border-color)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        <NutrientTable nutrients={item.nutrients} />
                    </div>
                ))}
            </div>

            <div style={{ position: 'fixed', bottom: 56, left: 0, right: 0, maxWidth: '480px', margin: '0 auto', padding: '16px', background: 'var(--bg-color)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', zIndex: 10 }}>
                <button onClick={onBack} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                    再入力
                </button>
                <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '16px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold' }}>
                    {loading ? '保存中...' : '✓ 記録を保存する'}
                </button>
            </div>
        </div>
    )
}
