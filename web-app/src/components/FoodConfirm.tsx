import { useEffect, useRef, useState } from 'react'

import { confirmFood, searchFoodCandidates } from '../api/food'
import type { FoodAnalyzeResponse, FoodAnalyzeResult, NutrientDetails } from '../api/types'
import { MEAL_TYPES, suggestMealType } from '../constants/food'
import { useDateContext } from '../context/DateContext'
import NutrientTable from './NutrientTable'

interface FoodConfirmProps {
    analyzeData: FoodAnalyzeResponse
    source?: 'gemini' | 'manual'
    onConfirmSuccess: () => void
    onBack: () => void
}

type ConfirmItem = FoodAnalyzeResult & {
    save_to_favorites?: boolean
    meal_type?: string
    base_item?: FoodAnalyzeResult
    from_favorite?: boolean
    amount_g_input?: string
}

function isReasonableMatch(queryName: string, resultName: string): boolean {
    const q = queryName.replace(/\s+/g, '')
    const r = resultName.replace(/\s+/g, '')
    if (q.length === 0 || r.length === 0) return false
    if (r.includes(q)) return true
    const ratio = Math.min(q.length, r.length) / Math.max(q.length, r.length)
    return ratio >= 0.4
}

function roundNutrientValue(value: number): number {
    return Number(value.toFixed(Math.abs(value) >= 100 ? 1 : 2))
}

function scaleNutrients(base: NutrientDetails, ratio: number): NutrientDetails {
    return Object.fromEntries(
        Object.entries(base).map(([key, value]) => [
            key,
            typeof value === 'number' ? roundNutrientValue(value * ratio) : value,
        ]),
    ) as NutrientDetails
}

function inferAmountG(item: FoodAnalyzeResult): number | null {
    if (typeof item.amount_g === 'number' && Number.isFinite(item.amount_g) && item.amount_g > 0) {
        return item.amount_g
    }
    const match = item.amount.match(/(\d+(?:\.\d+)?)\s*g/i)
    if (!match) return null
    const parsed = Number(match[1])
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function buildConfirmItem(item: FoodAnalyzeResult): ConfirmItem {
    const amountG = inferAmountG(item)
    const normalized: FoodAnalyzeResult = {
        ...item,
        name: item.display_name ?? item.name,
        display_name: item.display_name ?? item.name,
        amount_g: amountG,
    }
    return {
        ...normalized,
        save_to_favorites: true,
        meal_type: suggestMealType(),
        base_item: structuredClone(normalized),
        from_favorite: normalized.source_type === 'custom',
        amount_g_input: amountG != null ? String(amountG) : '',
    }
}

function getBaseAmountG(item: ConfirmItem): number | null {
    const base = item.base_item
    if (!base) return null
    if (base.per100g_nutrients) return 100
    return inferAmountG(base)
}

function getSourceBadge(item: ConfirmItem): { label: string; background: string } | null {
    if (item.source_type === 'master') {
        return { label: '成分表', background: '#166534' }
    }
    if (item.source_type === 'custom' || item.from_favorite) {
        return { label: '登録済み', background: 'var(--accent-color)' }
    }
    return null
}

export default function FoodConfirm({ analyzeData, source = 'gemini', onConfirmSuccess, onBack }: FoodConfirmProps) {
    const { activeDate } = useDateContext()
    const [items, setItems] = useState<ConfirmItem[]>(() => analyzeData.items.map(buildConfirmItem))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [suggestions, setSuggestions] = useState<FoodAnalyzeResult[]>([])
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const matchAll = async () => {
            const results = await Promise.all(
                analyzeData.items.map(async (item) => {
                    try {
                        const candidates = await searchFoodCandidates(item.name)
                        if (candidates.length > 0 && isReasonableMatch(item.name, candidates[0].name)) {
                            return candidates[0]
                        }
                    } catch {
                        // Candidate lookup failure is non-critical.
                    }
                    return null
                }),
            )

            setItems((prev) => prev.map((item, index) => {
                const match = results[index]
                if (!match) return item
                const merged = buildConfirmItem(match)
                return {
                    ...merged,
                    meal_type: item.meal_type,
                    save_to_favorites: true,
                    from_favorite: match.source_type === 'custom',
                }
            }))
        }

        matchAll()
    }, [analyzeData.items])

    const deleteItem = (index: number) => {
        setItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
    }

    const startEditing = (index: number) => {
        setEditingIndex(index)
        setEditName(items[index].display_name ?? items[index].name)
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
                const candidates = await searchFoodCandidates(value.trim())
                setSuggestions(candidates)
            } catch {
                setSuggestions([])
            }
        }, 300)
    }

    const applyCandidate = (index: number, candidate: FoodAnalyzeResult) => {
        setItems((prev) => prev.map((item, currentIndex) => {
            if (currentIndex !== index) return item
            const updated = buildConfirmItem(candidate)
            return {
                ...updated,
                meal_type: item.meal_type,
                save_to_favorites: true,
                from_favorite: candidate.source_type === 'custom',
            }
        }))
        setEditingIndex(null)
        setSuggestions([])
    }

    const confirmNameEdit = (index: number) => {
        if (editName.trim()) {
            setItems((prev) => prev.map((item, currentIndex) => {
                if (currentIndex !== index) return item
                return {
                    ...item,
                    name: editName.trim(),
                    display_name: editName.trim(),
                }
            }))
        }
        setEditingIndex(null)
        setSuggestions([])
    }

    const updateItemAmountG = (index: number, nextValue: string) => {
        setItems((prev) => prev.map((item, currentIndex) => {
            if (currentIndex !== index) return item

            const baseItem = item.base_item ?? item
            const baseNutrients = baseItem.per100g_nutrients ?? baseItem.nutrients
            const baseAmountG = getBaseAmountG(item)

            const trimmed = nextValue.trim()
            if (!trimmed) {
                return {
                    ...item,
                    amount_g: inferAmountG(baseItem),
                    amount_g_input: '',
                    nutrients: baseItem.nutrients,
                }
            }

            const parsed = Number(trimmed)
            if (!Number.isFinite(parsed) || parsed <= 0 || !baseAmountG) {
                return {
                    ...item,
                    amount_g_input: nextValue,
                }
            }

            const ratio = parsed / baseAmountG
            return {
                ...item,
                amount_g: parsed,
                amount_g_input: nextValue,
                nutrients: scaleNutrients(baseNutrients, ratio),
            }
        }))
    }

    const handleSave = async () => {
        setLoading(true)
        setError(null)
        try {
            const payloadItems = items.map(({ base_item, from_favorite, amount_g_input, ...rest }) => ({
                ...rest,
                amount_g: rest.amount_g ?? inferAmountG(base_item ?? rest) ?? null,
            }))
            await confirmFood(payloadItems, activeDate, new Date().toISOString(), source)
            setShowSuccess(true)
            setTimeout(() => onConfirmSuccess(), 1000)
        } catch {
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

            {error ? <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px' }}>{error}</div> : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {items.map((item, index) => {
                    const badge = getSourceBadge(item)
                    return (
                        <div key={`${item.display_name ?? item.name}-${index}`} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
                            <button
                                onClick={() => deleteItem(index)}
                                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                aria-label="この品目を削除"
                            >✕</button>

                            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', paddingRight: '32px' }}>
                                {MEAL_TYPES.map((mealType) => (
                                    <button
                                        key={mealType.value}
                                        onClick={() => setItems((prev) => prev.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, meal_type: mealType.value } : currentItem))}
                                        style={{
                                            flex: 1,
                                            padding: '8px 4px',
                                            borderRadius: '8px',
                                            background: item.meal_type === mealType.value ? 'var(--accent-color)' : 'var(--bg-color)',
                                            color: item.meal_type === mealType.value ? 'white' : 'var(--text-muted)',
                                            border: item.meal_type === mealType.value ? 'none' : '1px solid var(--border-color)',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: item.meal_type === mealType.value ? 'bold' : 'normal',
                                        }}
                                    >
                                        {mealType.emoji} {mealType.label}
                                    </button>
                                ))}
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(item.brand && item.brand !== 'null') ? item.brand : '一般'}</div>
                                    {item.food_group ? <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.food_group}</span> : null}
                                    {badge ? (
                                        <span style={{ fontSize: '11px', background: badge.background, color: 'white', padding: '1px 6px', borderRadius: '4px' }}>{badge.label}</span>
                                    ) : null}
                                </div>
                                {editingIndex === index ? (
                                    <div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(event) => handleNameChange(event.target.value)}
                                                onKeyDown={(event) => { if (event.key === 'Enter') confirmNameEdit(index) }}
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
                                                {suggestions.slice(0, 5).map((candidate, candidateIndex) => (
                                                    <button
                                                        key={candidate.id ?? candidateIndex}
                                                        onClick={() => applyCandidate(index, candidate)}
                                                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'var(--surface)', border: 'none', borderBottom: candidateIndex < Math.min(suggestions.length, 5) - 1 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', fontSize: '14px' }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                                            <div>
                                                                <span style={{ fontWeight: 'bold' }}>{candidate.display_name ?? candidate.name}</span>
                                                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>{candidate.amount}</span>
                                                            </div>
                                                            <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '13px' }}>
                                                                {candidate.nutrients.calories?.toFixed(0) || '?'} kcal
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
                                        {item.display_name ?? item.name}
                                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>✎</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: '8px', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>分量表示</div>
                                    <input
                                        type="text"
                                        value={item.amount}
                                        onChange={(event) => {
                                            const nextAmount = event.target.value
                                            setItems((prev) => prev.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, amount: nextAmount } : currentItem))
                                        }}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>g数</div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        inputMode="decimal"
                                        value={item.amount_g_input ?? ''}
                                        onChange={(event) => updateItemAmountG(index, event.target.value)}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <NutrientTable nutrients={item.nutrients} />
                        </div>
                    )
                })}
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
