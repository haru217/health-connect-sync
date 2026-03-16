import { useState } from 'react'
import type { FoodAnalyzeResponse, FoodAnalyzeResult } from '../api/types'
import NutrientTable from './NutrientTable'
import { confirmFood } from '../api/food'
import { useDateContext } from '../context/DateContext'
import { MEAL_TYPES, suggestMealType } from '../constants/food'

interface FoodConfirmProps {
    analyzeData: FoodAnalyzeResponse
    onConfirmSuccess: () => void
    onBack: () => void
}

export default function FoodConfirm({ analyzeData, onConfirmSuccess, onBack }: FoodConfirmProps) {
    const { activeDate } = useDateContext()
    const [items, setItems] = useState<Array<FoodAnalyzeResult & { save_to_favorites?: boolean; meal_type?: string; multiplier?: number; base_item?: FoodAnalyzeResult }>>(
        analyzeData.items.map(item => ({ ...item, save_to_favorites: true, meal_type: suggestMealType(), multiplier: 1, base_item: structuredClone(item) }))
    )
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)

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
            const payloadItems = items.map(({ base_item, multiplier, ...rest }) => rest)
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
        return <div>データがありません</div>
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
                    <div key={index} style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.brand || '一般'}</div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{item.name}</div>
                            </div>
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

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={item.save_to_favorites ?? true}
                                    onChange={e => {
                                        setItems(prev => prev.map((it, i) => i === index ? { ...it, save_to_favorites: e.target.checked } : it))
                                    }}
                                />
                                この食事をお気に入りに保存する
                            </label>
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
