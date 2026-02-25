# Iteration 5 — Gemini 用指示書（MyScreen 実装 + AiScreen 削除）

## 背景・前提

Health AI Advisor v3 の最終 Iteration です。

- `web-app/src/screens/MyScreen.tsx` は現在スタブ（「マイページ Coming soon」）
- `web-app/src/screens/AiScreen.tsx` を削除
- App.tsx の `'ai'` ルーティングは既に `'my'` に変更済み

## 対象ファイル

| ファイル | 操作 |
|---|---|
| `web-app/src/screens/MyScreen.tsx` | スタブを全面実装 |
| `web-app/src/screens/MyScreen.css` | 新規作成 |
| `web-app/src/screens/AiScreen.tsx` | **削除** |
| `web-app/src/api/types.ts` | 型追加 |
| `web-app/src/api/healthApi.ts` | 関数追加 |

---

## Step 1: types.ts に型追加

```typescript
export interface ConnectionStatusResponse {
  last_sync_at: string | null       // 最終同期日時（ISO8601）
  total_records: number             // 健康レコード総数
  has_weight_data: boolean
  has_sleep_data: boolean
  has_activity_data: boolean
  has_vitals_data: boolean
}
```

---

## Step 2: healthApi.ts に関数追加

```typescript
export async function fetchConnectionStatus(): Promise<ConnectionStatusResponse> {
  return apiFetch<ConnectionStatusResponse>('/api/connection-status')
}
```

（`ProfileResponse` は既に `fetchProfile()` と `ProfileResponse` 型が存在するので追加不要）

---

## Step 3: AiScreen.tsx を削除

`web-app/src/screens/AiScreen.tsx` ファイルを削除してください。
App.tsx ではすでに AiScreen の import と case が削除されています。

---

## Step 4: MyScreen.tsx 全面実装

### 画面構成

```
┌─────────────────────────────────┐
│  ← 2月25日（火）  →             │  ← DateNavBar
├─────────────────────────────────┤
│  👤 プロフィール                 │
│  ─────────────────────────      │
│  名前:     [田中 太郎     ]     │
│  身長:     [172        ] cm    │
│  生年:     [1985       ] 年    │
│  性別:     [男性 ▼     ]       │
│  目標体重: [68.0       ] kg    │
│                   [保存する]    │
├─────────────────────────────────┤
│  📱 Health Connect 連携状況      │
│  ─────────────────────────      │
│  最終同期: 2026/02/25 08:30     │
│  記録数:   12,450件             │
│  ● 体重    ● 睡眠    ● 活動    │
│  ● バイタル                    │
└─────────────────────────────────┘
```

### コンポーネント構成

```tsx
export default function MyScreen() {
  return (
    <div className="my-container">
      <DateNavBar />
      <ProfileSection />
      <ConnectionSection />
    </div>
  )
}
```

---

### ProfileSection（プロフィール編集）

```tsx
function ProfileSection() {
  const [profile, setProfile] = useState<ProfileResponse>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile(profile)  // PUT /api/profile
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // エラー表示
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="my-card">
      <h2 className="my-card-title">👤 プロフィール</h2>
      <div className="my-form">
        <label className="my-form-row">
          <span>名前</span>
          <input type="text" value={profile.name ?? ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
        </label>
        <label className="my-form-row">
          <span>身長</span>
          <div className="my-input-with-unit">
            <input type="number" min={100} max={250} value={profile.height_cm ?? ''} onChange={e => setProfile(p => ({ ...p, height_cm: Number(e.target.value) || undefined }))} />
            <span className="my-unit">cm</span>
          </div>
        </label>
        <label className="my-form-row">
          <span>生年</span>
          <div className="my-input-with-unit">
            <input type="number" min={1920} max={2010} value={profile.birth_year ?? ''} onChange={e => setProfile(p => ({ ...p, birth_year: Number(e.target.value) || undefined }))} />
            <span className="my-unit">年</span>
          </div>
        </label>
        <label className="my-form-row">
          <span>性別</span>
          <select value={profile.sex ?? ''} onChange={e => setProfile(p => ({ ...p, sex: e.target.value as 'male' | 'female' | 'other' }))}>
            <option value="">選択...</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
        </label>
        <label className="my-form-row">
          <span>目標体重</span>
          <div className="my-input-with-unit">
            <input type="number" min={30} max={200} step={0.1} value={profile.goal_weight_kg ?? ''} onChange={e => setProfile(p => ({ ...p, goal_weight_kg: Number(e.target.value) || undefined }))} />
            <span className="my-unit">kg</span>
          </div>
        </label>
        <button
          type="button"
          className={`my-save-btn ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
        </button>
      </div>
    </section>
  )
}
```

`updateProfile` は `fetchProfile` の PUT バージョン。`healthApi.ts` に以下を追加：

```typescript
export async function updateProfile(profile: ProfileResponse): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  })
}
```

---

### ConnectionSection（Health Connect 連携状況）

```tsx
function ConnectionSection() {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null)

  useEffect(() => {
    fetchConnectionStatus().then(setStatus).catch(() => {})
  }, [])

  if (!status) return null

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return '同期なし'
    const d = new Date(iso)
    return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <section className="my-card">
      <h2 className="my-card-title">📱 Health Connect 連携</h2>
      <div className="connection-info">
        <div className="connection-row">
          <span className="connection-label">最終同期</span>
          <span className="connection-value">{formatSyncTime(status.last_sync_at)}</span>
        </div>
        <div className="connection-row">
          <span className="connection-label">記録数</span>
          <span className="connection-value">{status.total_records.toLocaleString('ja-JP')} 件</span>
        </div>
        <div className="connection-dots">
          <span className={`conn-dot ${status.has_weight_data ? 'on' : 'off'}`}>体重</span>
          <span className={`conn-dot ${status.has_sleep_data ? 'on' : 'off'}`}>睡眠</span>
          <span className={`conn-dot ${status.has_activity_data ? 'on' : 'off'}`}>活動</span>
          <span className={`conn-dot ${status.has_vitals_data ? 'on' : 'off'}`}>バイタル</span>
        </div>
      </div>
    </section>
  )
}
```

---

## Step 5: MyScreen.css 新規作成

```css
.my-container {
  padding-bottom: 80px;
}

.my-card {
  margin: 12px 16px;
  padding: 16px;
  background: var(--surface, #1e2028);
  border-radius: 12px;
  border: 1px solid var(--border, #2a2d3a);
}

.my-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #e8eaf0);
  margin-bottom: 16px;
}

.my-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.my-form-row > span {
  font-size: 14px;
  color: var(--text-secondary, #8b90a7);
  min-width: 70px;
}

.my-form-row input,
.my-form-row select {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg, #13151c);
  border: 1px solid var(--border, #2a2d3a);
  border-radius: 8px;
  color: var(--text-primary, #e8eaf0);
  font-size: 14px;
}

.my-input-with-unit {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.my-input-with-unit input {
  flex: 1;
}

.my-unit {
  font-size: 13px;
  color: var(--text-muted, #4a5068);
}

.my-save-btn {
  margin-top: 8px;
  padding: 12px;
  background: var(--accent, #5b6af0);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.my-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.my-save-btn.saved { background: #16a34a; }

/* 連携状況 */
.connection-info { display: flex; flex-direction: column; gap: 10px; }
.connection-row { display: flex; justify-content: space-between; }
.connection-label { font-size: 13px; color: var(--text-secondary); }
.connection-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }

.connection-dots { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.conn-dot { font-size: 13px; padding: 2px 0; }
.conn-dot::before { content: '● '; }
.conn-dot.on::before { color: var(--accent, #5b6af0); }
.conn-dot.off::before { color: var(--text-muted, #4a5068); }
```

---

## 注意事項

- `import React from 'react'` を先頭に記述
- `AiScreen.tsx` は**ファイルごと削除**（App.tsx ではすでに参照されていない）
- `updateProfile` は `healthApi.ts` に追加（既存の `fetchProfile` と同ファイル）
- プロフィールフォームは `number` 型の入力値を `undefined` にフォールバックする（空入力対応）
- `fetchConnectionStatus` が失敗した場合は連携セクションを非表示にするだけでよい（エラー表示不要）
