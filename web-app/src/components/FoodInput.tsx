import { useState, useEffect, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { searchFoodCandidates, analyzeFoodText, analyzeFoodImage } from '../api/food'
import type { FoodAnalyzeResponse, FoodAnalyzeResult, NutrientDetails } from '../api/types'

interface FoodInputProps {
    onAnalyzeSuccess: (data: FoodAnalyzeResponse, source?: 'gemini' | 'manual') => void
    onCancel: () => void
}

type InputMode = 'text' | 'photo' | 'manual'

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

    // 手入力用
    const [manualName, setManualName] = useState('')
    const [manualAmount, setManualAmount] = useState('')
    const [manualKcal, setManualKcal] = useState('')
    const [manualProtein, setManualProtein] = useState('')
    const [manualFat, setManualFat] = useState('')
    const [manualCarbs, setManualCarbs] = useState('')

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
                        const res = await searchFoodCandidates(trimmed)
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

    const handleManualSubmit = () => {
        if (!manualName.trim()) return
        const amount = manualAmount.trim() || '1食'
        const amountMatch = amount.match(/(\d+(?:\.\d+)?)\s*g/i)
        const emptyNutrients: NutrientDetails = {
            calories: null, protein_g: null, fat_g: null, carbs_g: null,
            saturated_fat_g: null, omega3_mg: null, omega6_mg: null, trans_fat_g: null,
            sugar_g: null, fiber_g: null,
            vitamin_a_ug: null, vitamin_d_ug: null, vitamin_e_mg: null, vitamin_k_ug: null,
            vitamin_b1_mg: null, vitamin_b2_mg: null, vitamin_b6_mg: null, vitamin_b12_ug: null,
            vitamin_c_mg: null, niacin_mg: null, folate_ug: null, pantothenic_acid_mg: null, biotin_ug: null,
            sodium_mg: null, potassium_mg: null, calcium_mg: null, magnesium_mg: null, phosphorus_mg: null,
            iron_mg: null, zinc_mg: null, copper_mg: null, manganese_mg: null,
            selenium_ug: null, chromium_ug: null, molybdenum_ug: null, iodine_ug: null,
            cholesterol_mg: null, purine_mg: null, caffeine_mg: null, alcohol_g: null,
        }
        const item: FoodAnalyzeResult = {
            name: manualName.trim(),
            display_name: manualName.trim(),
            brand: null,
            amount,
            amount_g: amountMatch ? Number(amountMatch[1]) : null,
            nutrients: {
                ...emptyNutrients,
                calories: manualKcal ? Number(manualKcal) : null,
                protein_g: manualProtein ? Number(manualProtein) : null,
                fat_g: manualFat ? Number(manualFat) : null,
                carbs_g: manualCarbs ? Number(manualCarbs) : null,
            },
        }
        onAnalyzeSuccess({ items: [item] }, 'manual')
    }

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (mode === 'text') handleAnalyze(text)
        else if (mode === 'photo') handleImageAnalyze()
        else handleManualSubmit()
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

            <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
                {(['text', 'photo', 'manual'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => switchMode(m)}
                        style={{ flex: 1, padding: '10px 4px', background: 'var(--surface)', border: `2px solid ${mode === m ? 'var(--accent-color)' : 'transparent'}`, borderRadius: '12px', color: mode === m ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '14px' }}
                    >
                        {m === 'text' ? '文字で入力' : m === 'photo' ? '写真で入力' : '手入力'}
                    </button>
                ))}
            </div>

            {mode === 'manual' ? (
                <form onSubmit={onSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                            type="text"
                            value={manualName}
                            onChange={e => setManualName(e.target.value)}
                            placeholder="食品名 (例: 鶏むね肉)"
                            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                        />
                        <input
                            type="text"
                            value={manualAmount}
                            onChange={e => setManualAmount(e.target.value)}
                            placeholder="分量 (例: 100g) ※任意"
                            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>カロリー (kcal)</label>
                                <input type="number" value={manualKcal} onChange={e => setManualKcal(e.target.value)} placeholder="0" inputMode="decimal"
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>タンパク質 (g)</label>
                                <input type="number" value={manualProtein} onChange={e => setManualProtein(e.target.value)} placeholder="0" inputMode="decimal"
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>脂質 (g)</label>
                                <input type="number" value={manualFat} onChange={e => setManualFat(e.target.value)} placeholder="0" inputMode="decimal"
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>炭水化物 (g)</label>
                                <input type="number" value={manualCarbs} onChange={e => setManualCarbs(e.target.value)} placeholder="0" inputMode="decimal"
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={!manualName.trim()}
                            style={{ width: '100%', padding: '16px', background: 'var(--accent-color)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold', opacity: manualName.trim() ? 1 : 0.5, marginTop: '8px' }}
                        >
                            確認画面へ
                        </button>
                    </div>
                </form>
            ) : mode === 'text' ? (
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
