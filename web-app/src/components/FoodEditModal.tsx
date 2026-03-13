import { useState } from 'react'
import type { FoodHistoryItem } from '../api/types'
import { MEAL_TYPES } from '../constants/food'

interface FoodEditModalProps {
    item: FoodHistoryItem
    editLoading: boolean
    onSave: (data: {
        name: string
        amount: string
        kcal: number
        protein_g: number
        fat_g: number
        carbs_g: number
        meal_type: string | null
    }) => void
    onDelete: () => void
    onClose: () => void
}

export default function FoodEditModal({ item, editLoading, onSave, onDelete, onClose }: FoodEditModalProps) {
    const [editForm, setEditForm] = useState({
        name: item.name,
        amount: item.amount,
        kcal: String(item.nutrients.calories ?? 0),
        protein_g: String(item.nutrients.protein_g ?? 0),
        fat_g: String(item.nutrients.fat_g ?? 0),
        carbs_g: String(item.nutrients.carbs_g ?? 0),
        meal_type: item.mealType ?? null,
    })
    const [deleteConfirm, setDeleteConfirm] = useState(false)

    const handleSave = () => {
        onSave({
            name: editForm.name,
            amount: editForm.amount,
            kcal: Number(editForm.kcal),
            protein_g: Number(editForm.protein_g),
            fat_g: Number(editForm.fat_g),
            carbs_g: Number(editForm.carbs_g),
            meal_type: editForm.meal_type,
        })
    }

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>✕</button>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>食事を編集</h3>
                    <div style={{ width: '28px' }}></div> {/* Spacer for centering */}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>食事のタイミング</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {MEAL_TYPES.map(mt => (
                                <button
                                    key={mt.value}
                                    onClick={() => setEditForm(prev => ({ ...prev, meal_type: mt.value }))}
                                    style={{
                                        flex: 1, padding: '10px 4px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer',
                                        background: editForm.meal_type === mt.value ? 'var(--accent-color)' : 'var(--bg-color)',
                                        color: editForm.meal_type === mt.value ? 'white' : 'var(--text-primary)',
                                        border: editForm.meal_type === mt.value ? 'none' : '1px solid var(--border-color)',
                                        fontWeight: editForm.meal_type === mt.value ? 'bold' : 'normal',
                                    }}
                                >
                                    {mt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>メニュー名</label>
                        <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>分量</label>
                        <input type="text" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>カロリー (kcal)</label>
                            <input type="number" value={editForm.kcal} onChange={e => setEditForm({ ...editForm, kcal: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>タンパク質 (g)</label>
                            <input type="number" value={editForm.protein_g} step="0.1" onChange={e => setEditForm({ ...editForm, protein_g: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>脂質 (g)</label>
                            <input type="number" value={editForm.fat_g} step="0.1" onChange={e => setEditForm({ ...editForm, fat_g: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>炭水化物 (g)</label>
                            <input type="number" value={editForm.carbs_g} step="0.1" onChange={e => setEditForm({ ...editForm, carbs_g: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '15px' }} />
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <button onClick={handleSave} disabled={editLoading} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 12px var(--shadow-color)' }}>
                        {editLoading ? '保存中...' : '保存する'}
                    </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', paddingBottom: '24px' }}>
                    {deleteConfirm ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '14px', color: 'var(--danger-color)', textAlign: 'center', fontWeight: 'bold', marginBottom: '8px' }}>本当に削除しますか？</div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>キャンセル</button>
                                <button onClick={onDelete} disabled={editLoading} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--danger-color)', color: 'white', border: 'none', fontSize: '15px', fontWeight: 'bold' }}>削除する</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'transparent', color: 'var(--danger-color)', border: 'none', fontSize: '15px', fontWeight: 'bold' }}>
                            この記録を削除
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
