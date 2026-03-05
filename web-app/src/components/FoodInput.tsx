import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { searchFoodFavorites, analyzeFoodText } from '../api/food'
import type { FoodAnalyzeResponse, FoodAnalyzeResult } from '../api/types'

interface FoodInputProps {
    onAnalyzeSuccess: (data: FoodAnalyzeResponse) => void
    onCancel: () => void
}

export default function FoodInput({ onAnalyzeSuccess, onCancel }: FoodInputProps) {
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [favorites, setFavorites] = useState<FoodAnalyzeResult[]>([])

    useEffect(() => {
        const trimmed = text.trim()
        if (!trimmed) {
            setFavorites([])
            return
        }
        let active = true
        const fetchFavs = async () => {
            try {
                const res = await searchFoodFavorites(trimmed)
                if (active) setFavorites(res)
            } catch {
                // ignore
            }
        }
        const timer = setTimeout(fetchFavs, 300)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [text])

    const handleAnalyze = async (query: string) => {
        if (!query.trim()) return
        setLoading(true)
        setError(null)
        try {
            const res = await analyzeFoodText(query)
            onAnalyzeSuccess(res)
        } catch (err) {
            setError('解析に失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        handleAnalyze(text)
    }

    return (
        <div className="food-input-container" style={{ padding: '16px', background: 'var(--bg-color)', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>食事を記録</h2>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button style={{ flex: 1, padding: '12px', background: 'var(--surface)', border: '2px solid var(--accent-color)', borderRadius: '12px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                    文字で入力
                </button>
                <button disabled style={{ flex: 1, padding: '12px', background: '#f0f0f0', border: '2px solid transparent', borderRadius: '12px', color: '#ccc' }}>
                    写真で入力 (準備中)
                </button>
            </div>

            <form onSubmit={onSubmit} style={{ marginBottom: '16px' }}>
                <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="何を食べましたか？ (例: 吉野屋 牛丼)"
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                />
            </form>

            {error ? <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '13px' }}>{error}</div> : null}

            <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {text.trim() ? '候補' : 'よく使う食品'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {favorites.length > 0 ? favorites.map((fav, index) => (
                        <button
                            key={fav.id || index}
                            onClick={() => onAnalyzeSuccess({ items: [fav] })}
                            style={{ textAlign: 'left', padding: '14px', background: 'var(--surface)', borderRadius: '12px', border: 'none', fontSize: '15px', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{fav.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {fav.amount} · {fav.brand || '一般'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                        {fav.nutrients.calories?.toFixed(0) || '?'} kcal
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        P{fav.nutrients.protein_g?.toFixed(0) || '?'} F{fav.nutrients.fat_g?.toFixed(0) || '?'} C{fav.nutrients.carbs_g?.toFixed(0) || '?'}
                                    </div>
                                </div>
                            </div>
                        </button>
                    )) : text.trim() ? (
                        <button onClick={() => handleAnalyze(text)} style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold' }}>
                            AIで栄養を調べる
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
