import { useState } from 'react'
import type { NutrientDetails } from '../api/types'

interface NutrientTableProps {
    nutrients: NutrientDetails
}

export default function NutrientTable({ nutrients }: NutrientTableProps) {
    const [expanded, setExpanded] = useState(false)

    const formatVal = (val: number | null | undefined, unit: string) => {
        if (val == null) return '-- ' + unit
        return `${val.toFixed(1)} ${unit}`
    }

    // MECE分類に従って一部抜粋
    const mainMacros = [
        { label: 'エネルギー', val: nutrients.calories, unit: 'kcal' },
        { label: 'タンパク質', val: nutrients.protein_g, unit: 'g' },
        { label: '脂質', val: nutrients.fat_g, unit: 'g' },
        { label: '炭水化物', val: nutrients.carbs_g, unit: 'g' },
    ]

    const lipidDetails = [
        { label: '飽和脂肪酸', val: nutrients.saturated_fat_g, unit: 'g' },
        { label: 'オメガ3', val: nutrients.omega3_mg, unit: 'mg' },
        { label: 'オメガ6', val: nutrients.omega6_mg, unit: 'mg' },
        { label: 'トランス脂肪酸', val: nutrients.trans_fat_g, unit: 'g' },
        { label: '糖質', val: nutrients.sugar_g, unit: 'g' },
        { label: '食物繊維', val: nutrients.fiber_g, unit: 'g' },
    ]

    const vitaminDetails = [
        { label: 'ビタミンA', val: nutrients.vitamin_a_ug, unit: 'μg' },
        { label: 'ビタミンD', val: nutrients.vitamin_d_ug, unit: 'μg' },
        { label: 'ビタミンE', val: nutrients.vitamin_e_mg, unit: 'mg' },
        { label: 'ビタミンK', val: nutrients.vitamin_k_ug, unit: 'μg' },
        { label: 'ビタミンB1', val: nutrients.vitamin_b1_mg, unit: 'mg' },
        { label: 'ビタミンB2', val: nutrients.vitamin_b2_mg, unit: 'mg' },
        { label: 'ビタミンB6', val: nutrients.vitamin_b6_mg, unit: 'mg' },
        { label: 'ビタミンB12', val: nutrients.vitamin_b12_ug, unit: 'μg' },
        { label: 'ビタミンC', val: nutrients.vitamin_c_mg, unit: 'mg' },
        { label: 'ナイアシン', val: nutrients.niacin_mg, unit: 'mg' },
        { label: '葉酸', val: nutrients.folate_ug, unit: 'μg' },
        { label: 'パントテン酸', val: nutrients.pantothenic_acid_mg, unit: 'mg' },
        { label: 'ビオチン', val: nutrients.biotin_ug, unit: 'μg' },
    ]

    const mineralDetails = [
        { label: 'ナトリウム', val: nutrients.sodium_mg, unit: 'mg' },
        { label: 'カリウム', val: nutrients.potassium_mg, unit: 'mg' },
        { label: 'カルシウム', val: nutrients.calcium_mg, unit: 'mg' },
        { label: 'マグネシウム', val: nutrients.magnesium_mg, unit: 'mg' },
        { label: 'リン', val: nutrients.phosphorus_mg, unit: 'mg' },
        { label: '鉄', val: nutrients.iron_mg, unit: 'mg' },
        { label: '亜鉛', val: nutrients.zinc_mg, unit: 'mg' },
        { label: '銅', val: nutrients.copper_mg, unit: 'mg' },
        { label: 'マンガン', val: nutrients.manganese_mg, unit: 'mg' },
        { label: 'セレン', val: nutrients.selenium_ug, unit: 'μg' },
        { label: 'クロム', val: nutrients.chromium_ug, unit: 'μg' },
        { label: 'モリブデン', val: nutrients.molybdenum_ug, unit: 'μg' },
        { label: 'ヨウ素', val: nutrients.iodine_ug, unit: 'μg' },
    ]

    const otherDetails = [
        { label: 'コレステロール', val: nutrients.cholesterol_mg, unit: 'mg' },
        { label: 'プリン体', val: nutrients.purine_mg, unit: 'mg' },
        { label: 'カフェイン', val: nutrients.caffeine_mg, unit: 'mg' },
        { label: 'アルコール', val: nutrients.alcohol_g, unit: 'g' },
    ]

    return (
        <div className="nutrient-table" style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', margin: '16px 0' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>栄養成分</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {mainMacros.map(m => (
                    <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{m.label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatVal(m.val, m.unit)}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => setExpanded(!expanded)}
                style={{ marginTop: '16px', width: '100%', padding: '8px', background: 'transparent', border: 'none', color: 'var(--accent-color)', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}
            >
                {expanded ? '▲ 詳細を閉じる' : '▼ 全ての栄養成分を見る'}
            </button>

            {expanded && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>脂質詳細・糖質・食物繊維</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            {lipidDetails.map(d => (
                                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{d.label}</span>
                                    <span style={{ fontSize: '13px' }}>{formatVal(d.val, d.unit)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>ビタミン</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            {vitaminDetails.map(d => (
                                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{d.label}</span>
                                    <span style={{ fontSize: '13px' }}>{formatVal(d.val, d.unit)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>ミネラル</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            {mineralDetails.map(d => (
                                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{d.label}</span>
                                    <span style={{ fontSize: '13px' }}>{formatVal(d.val, d.unit)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>その他</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            {otherDetails.map(d => (
                                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{d.label}</span>
                                    <span style={{ fontSize: '13px' }}>{formatVal(d.val, d.unit)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
