import { useState, useEffect, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { searchFoodFavorites, analyzeFoodText, analyzeFoodImage } from '../api/food'
import type { FoodAnalyzeResponse, FoodAnalyzeResult } from '../api/types'

interface FoodInputProps {
    onAnalyzeSuccess: (data: FoodAnalyzeResponse) => void
    onCancel: () => void
}

type InputMode = 'text' | 'photo'

export default function FoodInput({ onAnalyzeSuccess, onCancel }: FoodInputProps) {
    const [mode, setMode] = useState<InputMode>('text')
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [favorites, setFavorites] = useState<FoodAnalyzeResult[]>([])

    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [photoHint, setPhotoHint] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (mode !== 'text') return
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
                // Favorites search failure is non-critical
            }
        }
        const timer = setTimeout(fetchFavs, 300)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [text, mode])

    const handleAnalyze = async (query: string) => {
        if (!query.trim()) return
        setLoading(true)
        setError(null)
        try {
            const res = await analyzeFoodText(query)
            onAnalyzeSuccess(res)
        } catch {
            setError('解析に失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }

    const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
        setError(null)
    }

    const handleImageAnalyze = async () => {
        if (!imageFile) return
        setLoading(true)
        setError(null)
        try {
            const res = await analyzeFoodImage(imageFile, photoHint)
            onAnalyzeSuccess(res)
        } catch {
            setError('画像解析に失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }

    const clearImage = () => {
        setImageFile(null)
        setImagePreview(null)
        setPhotoHint('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (mode === 'text') handleAnalyze(text)
        else handleImageAnalyze()
    }

    const switchMode = (newMode: InputMode) => {
        setMode(newMode)
        setError(null)
    }

    return (
        <div className="food-input-container" style={{ padding: '16px', background: 'var(--bg-color)', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>食事を記録</h2>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button
                    onClick={() => switchMode('text')}
                    style={{ flex: 1, padding: '12px', background: 'var(--surface)', border: `2px solid ${mode === 'text' ? 'var(--accent-color)' : 'transparent'}`, borderRadius: '12px', color: mode === 'text' ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 'bold' }}
                >
                    文字で入力
                </button>
                <button
                    onClick={() => switchMode('photo')}
                    style={{ flex: 1, padding: '12px', background: 'var(--surface)', border: `2px solid ${mode === 'photo' ? 'var(--accent-color)' : 'transparent'}`, borderRadius: '12px', color: mode === 'photo' ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 'bold' }}
                >
                    写真で入力
                </button>
            </div>

            {mode === 'text' ? (
                <>
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
                                <button
                                    onClick={() => handleAnalyze(text)}
                                    disabled={loading}
                                    style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold', opacity: loading ? 0.6 : 1 }}
                                >
                                    {loading ? '解析中...' : 'AIで栄養を調べる'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageSelect}
                        style={{ display: 'none' }}
                    />

                    {!imagePreview ? (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{ width: '100%', padding: '48px 16px', background: 'var(--surface)', border: '2px dashed var(--border-color, #d1d5db)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                        >
                            <span style={{ fontSize: '32px' }}>📷</span>
                            写真を撮影 or ギャラリーから選択
                        </button>
                    ) : (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ position: 'relative', marginBottom: '12px' }}>
                                <img
                                    src={imagePreview}
                                    alt="選択した食事画像"
                                    style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '12px' }}
                                />
                                <button
                                    onClick={clearImage}
                                    style={{ position: 'absolute', top: '8px', right: '8px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                                >✕</button>
                            </div>
                            <input
                                type="text"
                                value={photoHint}
                                onChange={e => setPhotoHint(e.target.value)}
                                placeholder="補足テキスト (例: 松屋の牛丼) ※任意"
                                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px' }}
                            />
                            <button
                                onClick={handleImageAnalyze}
                                disabled={loading}
                                style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold', opacity: loading ? 0.6 : 1 }}
                            >
                                {loading ? '画像を解析中...' : 'AIで栄養を解析'}
                            </button>
                        </div>
                    )}

                    {error ? <div style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '13px' }}>{error}</div> : null}
                </>
            )}
        </div>
    )
}
