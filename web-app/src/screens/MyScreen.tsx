import { useEffect, useState, type ReactNode } from 'react'
import DateNavBar from '../components/DateNavBar'
import { fetchAiConfig, fetchConnectionStatus, fetchGeminiUsage, fetchProfile, saveProfile } from '../api/healthApi'
import type {
  AiConfigResponse,
  ConnectionStatusResponse,
  GeminiUsageResponse,
  ProfileResponse,
  ProfileUpdateRequest,
  RequestState,
} from '../api/types'
import './MyScreen.css'

type GenderValue = 'male' | 'female' | 'other'
type ExerciseFreqValue = 'none' | 'weekly12' | 'weekly35' | 'daily'
type ExerciseTypeValue = 'walk' | 'gym' | 'run' | 'bodyweight' | 'none'
type ExerciseIntensityValue = 'light' | 'moderate' | 'high'
type LensKey = 'lens_weight' | 'lens_bp' | 'lens_sleep' | 'lens_performance'

type ProfileFormState = {
  gender: GenderValue | ''
  birthYear: string
  heightCm: string
  exerciseFreq: ExerciseFreqValue
  exerciseType: ExerciseTypeValue
  exerciseIntensity: ExerciseIntensityValue
}

type AiReportState = {
  usage: GeminiUsageResponse
  config: AiConfigResponse
}

const GENDER_OPTIONS: ReadonlyArray<{ value: GenderValue | ''; label: string }> = [{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }, { value: 'other', label: 'その他' }, { value: '', label: '未設定' }]
const EXERCISE_FREQ_OPTIONS: ReadonlyArray<{ value: ExerciseFreqValue; label: string }> = [{ value: 'none', label: 'なし' }, { value: 'weekly12', label: '週1-2回' }, { value: 'weekly35', label: '週3-5回' }, { value: 'daily', label: '毎日' }]
const EXERCISE_TYPE_OPTIONS: ReadonlyArray<{ value: ExerciseTypeValue; label: string }> = [{ value: 'walk', label: 'ウォーキング' }, { value: 'gym', label: 'ジム' }, { value: 'run', label: 'ランニング' }, { value: 'bodyweight', label: '自重' }, { value: 'none', label: 'なし' }]
const EXERCISE_INTENSITY_OPTIONS: ReadonlyArray<{ value: ExerciseIntensityValue; label: string }> = [{ value: 'light', label: '軽い' }, { value: 'moderate', label: '中程度' }, { value: 'high', label: '高い' }]
const LENS_ITEMS: ReadonlyArray<{ key: LensKey; label: string }> = [{ key: 'lens_weight', label: 'ダイエット' }, { key: 'lens_bp', label: '血圧改善' }, { key: 'lens_sleep', label: '睡眠改善' }, { key: 'lens_performance', label: 'パフォーマンス' }]

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function toInputValue(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  return String(value)
}

function parseOptionalIntegerInput(value: string, min: number, max: number, label: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label}は${min}〜${max}で入力してください`)
  }
  return parsed
}

function parseOptionalNumberInput(
  value: string,
  min: number,
  max: number,
  label: string,
  digits = 1,
): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label}は${min}〜${max}で入力してください`)
  }
  return Number(parsed.toFixed(digits))
}

function deriveBirthYear(profile: ProfileResponse): number | null {
  if (typeof profile.birth_year === 'number' && Number.isFinite(profile.birth_year)) {
    return profile.birth_year
  }
  if (typeof profile.age !== 'number' || !Number.isFinite(profile.age)) {
    return null
  }
  return new Date().getFullYear() - profile.age
}

function createProfileForm(profile: ProfileResponse): ProfileFormState {
  const birthYear = deriveBirthYear(profile)
  return {
    gender: profile.gender ?? '',
    birthYear: birthYear == null ? '' : String(birthYear),
    heightCm: toInputValue(profile.height_cm),
    exerciseFreq: profile.exercise_freq ?? 'none',
    exerciseType: profile.exercise_type ?? 'none',
    exerciseIntensity: profile.exercise_intensity ?? 'moderate',
  }
}

function buildProfilePatch(form: ProfileFormState): ProfileUpdateRequest {
  const nowYear = new Date().getFullYear()
  const birthYear = parseOptionalIntegerInput(form.birthYear, 1900, nowYear, '生年')
  const age = birthYear == null ? null : nowYear - birthYear
  if (age != null && (age < 0 || age > 130)) {
    throw new Error('生年の入力値を確認してください')
  }
  return {
    age,
    gender: form.gender || null,
    height_cm: parseOptionalNumberInput(form.heightCm, 80, 250, '身長'),
    exercise_freq: form.exerciseFreq,
    exercise_type: form.exerciseType,
    exercise_intensity: form.exerciseIntensity,
  }
}

function formatGender(value: ProfileResponse['gender'] | ProfileResponse['sex'] | null | undefined): string {
  if (value === 'male') return '男性'
  if (value === 'female') return '女性'
  if (value === 'other') return 'その他'
  return '未設定'
}

function formatExerciseFreq(value: ProfileResponse['exercise_freq']): string {
  if (value === 'weekly12') return '週1-2回'
  if (value === 'weekly35') return '週3-5回'
  if (value === 'daily') return '毎日'
  if (value === 'none') return 'なし'
  return '未設定'
}

function formatExerciseType(value: ProfileResponse['exercise_type']): string {
  if (value === 'walk') return 'ウォーキング'
  if (value === 'gym') return 'ジム'
  if (value === 'run') return 'ランニング'
  if (value === 'bodyweight') return '自重'
  if (value === 'none') return 'なし'
  return '未設定'
}

function formatExerciseIntensity(value: ProfileResponse['exercise_intensity']): string {
  if (value === 'light') return '軽い'
  if (value === 'moderate') return '中程度'
  if (value === 'high') return '高い'
  return '未設定'
}

function formatBirthYear(profile: ProfileResponse): string {
  const year = deriveBirthYear(profile)
  return year == null ? '未設定' : `${year}年`
}

function buildProfileRows(profile: ProfileResponse): Array<{ label: string; value: string }> {
  return [
    { label: '性別', value: formatGender(profile.gender ?? profile.sex ?? null) },
    { label: '生年月', value: formatBirthYear(profile) },
    { label: '身長', value: profile.height_cm == null ? '未設定' : `${profile.height_cm} cm` },
    { label: '運動頻度', value: formatExerciseFreq(profile.exercise_freq ?? null) },
    { label: '運動種目', value: formatExerciseType(profile.exercise_type ?? null) },
    { label: '運動強度', value: formatExerciseIntensity(profile.exercise_intensity ?? null) },
  ]
}

function formatRelativeTime(value: string | null): string {
  if (!value) return '未同期'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value

  const diff = Date.now() - time
  if (diff <= 60_000) return 'たった今'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}分前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  if (hours < 48) return '昨日'

  const days = Math.floor(hours / 24)
  if (days <= 7) return `${days}日前`

  return new Date(time).toLocaleDateString('ja-JP')
}

function usageRate(usage: GeminiUsageResponse): number {
  if (usage.limit_jpy <= 0) {
    return 0
  }
  const raw = (usage.estimated_cost_jpy / usage.limit_jpy) * 100
  return Math.max(0, Math.min(100, raw))
}

function usageBarColor(rate: number): string {
  if (rate <= 70) return '#10b981'
  if (rate <= 90) return '#f59e0b'
  return '#ef4444'
}

function createLensPatch(key: LensKey, enabled: boolean): ProfileUpdateRequest {
  const flag = enabled ? 1 : 0
  if (key === 'lens_weight') return { lens_weight: flag }
  if (key === 'lens_bp') return { lens_bp: flag }
  if (key === 'lens_sleep') return { lens_sleep: flag }
  return { lens_performance: flag }
}

function SectionCard({ title, iconName, action, children }: { title: string; iconName?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="my-section-card">
      <div className="my-section-header">
        <h3 className="my-section-title">
          {iconName && (
            <span className="material-symbols-outlined my-section-title-icon" style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
          )}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="my-info-row">
      <span className="my-info-label">{label}</span>
      <span className="my-info-value">{value}</span>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="my-form-group">
      <span className="my-label">{label}</span>
      {children}
    </label>
  )
}

function StatusFlag({ ok }: { ok: boolean }) {
  return (
    <span className={`my-status-flag ${ok ? 'ok' : 'ng'}`}>
      {ok ? '✓' : '!'}
    </span>
  )
}

function ProfileView({ profile }: { profile: ProfileResponse }) {
  return (
    <div>
      {buildProfileRows(profile).map((item) => (
        <InfoRow key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  )
}

function ProfileBasicFields({
  form,
  onChange,
}: {
  form: ProfileFormState
  onChange: (value: ProfileFormState) => void
}) {
  return (
    <>
      <FormField label="性別">
        <select className="my-select" value={form.gender} onChange={(event) => onChange({ ...form, gender: event.target.value as GenderValue | '' })}>
          {GENDER_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
      <FormField label="生年月（西暦）">
        <input className="my-input" type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} value={form.birthYear} onChange={(event) => onChange({ ...form, birthYear: event.target.value })} placeholder="例: 1990" />
      </FormField>
      <FormField label="身長（cm）">
        <input className="my-input" type="number" inputMode="decimal" min={80} max={250} value={form.heightCm} onChange={(event) => onChange({ ...form, heightCm: event.target.value })} placeholder="例: 170" />
      </FormField>
    </>
  )
}

function ProfileExerciseFields({
  form,
  onChange,
}: {
  form: ProfileFormState
  onChange: (value: ProfileFormState) => void
}) {
  return (
    <>
      <FormField label="運動頻度">
        <select className="my-select" value={form.exerciseFreq} onChange={(event) => onChange({ ...form, exerciseFreq: event.target.value as ExerciseFreqValue })}>
          {EXERCISE_FREQ_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
      <FormField label="運動種目">
        <select className="my-select" value={form.exerciseType} onChange={(event) => onChange({ ...form, exerciseType: event.target.value as ExerciseTypeValue })}>
          {EXERCISE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
      <FormField label="運動強度">
        <select className="my-select" value={form.exerciseIntensity} onChange={(event) => onChange({ ...form, exerciseIntensity: event.target.value as ExerciseIntensityValue })}>
          {EXERCISE_INTENSITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
    </>
  )
}

function ProfileEditForm({
  form,
  onChange,
}: {
  form: ProfileFormState
  onChange: (value: ProfileFormState) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <ProfileBasicFields form={form} onChange={onChange} />
      <ProfileExerciseFields form={form} onChange={onChange} />
    </div>
  )
}

function ProfileEditActions({
  saving,
  onCancelEdit,
  onSave,
}: {
  saving: boolean
  onCancelEdit: () => void
  onSave: () => void
}) {
  return (
    <div className="my-btn-group">
      <button type="button" onClick={onCancelEdit} disabled={saving} className="my-btn-ghost">
        キャンセル
      </button>
      <button type="button" onClick={onSave} disabled={saving} className="my-btn-primary">
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}

function ProfileSection({
  state,
  isEditing,
  form,
  saving,
  error,
  onStartEdit,
  onCancelEdit,
  onSave,
  onFormChange,
}: {
  state: RequestState<ProfileResponse>
  isEditing: boolean
  form: ProfileFormState | null
  saving: boolean
  error: string | null
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onFormChange: (value: ProfileFormState) => void
}) {
  if (state.status === 'loading') {
    return <SectionCard title="プロフィール" iconName="person">読み込み中...</SectionCard>
  }
  if (state.status === 'error') {
    return <SectionCard title="プロフィール" iconName="person">読み込み失敗: {state.error}</SectionCard>
  }

  const editButton = !isEditing ? (
    <button type="button" onClick={onStartEdit} className="my-btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }}>
      編集
    </button>
  ) : undefined

  return (
    <SectionCard title="プロフィール" iconName="person" action={editButton}>
      {!isEditing ? <ProfileView profile={state.data} /> : null}
      {isEditing && form ? <ProfileEditForm form={form} onChange={onFormChange} /> : null}
      {error ? <div className="my-error-text">{error}</div> : null}
      {isEditing ? <ProfileEditActions saving={saving} onCancelEdit={onCancelEdit} onSave={onSave} /> : null}
    </SectionCard>
  )
}

function GoalWeightEditor({
  goalWeightInput,
  goalSaving,
  onGoalWeightInput,
  onGoalSave,
}: {
  goalWeightInput: string
  goalSaving: boolean
  onGoalWeightInput: (value: string) => void
  onGoalSave: () => void
}) {
  return (
    <FormField label="目標体重（kg）">
      <div style={{ display: 'flex', gap: '8px' }}>
        <input className="my-input" type="number" inputMode="decimal" step={0.1} min={20} max={300} value={goalWeightInput} onChange={(event) => onGoalWeightInput(event.target.value)} style={{ flex: 1 }} placeholder="例: 62.5" />
        <button type="button" onClick={onGoalSave} disabled={goalSaving} className="my-btn-primary">
          {goalSaving ? '...' : '保存'}
        </button>
      </div>
    </FormField>
  )
}

function LensToggleList({
  profile,
  lensPending,
  onLensToggle,
}: {
  profile: ProfileResponse
  lensPending: Set<LensKey>
  onLensToggle: (key: LensKey, enabled: boolean) => void
}) {
  return (
    <div className="my-lens-list">
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))', marginTop: '12px', marginBottom: '4px' }}>AIアシスタントの重点テーマ</div>
      {LENS_ITEMS.map((lens) => (
        <label key={lens.key} className={`my-lens-item ${profile[lens.key] === 1 ? 'active' : ''}`}>
          <span className="my-lens-label">{lens.label}</span>
          <input
            type="checkbox"
            className="my-lens-checkbox"
            checked={profile[lens.key] === 1}
            disabled={lensPending.has(lens.key)}
            onChange={(event) => onLensToggle(lens.key, event.target.checked)}
          />
        </label>
      ))}
    </div>
  )
}

function GoalSection({
  state,
  goalWeightInput,
  goalSaving,
  goalError,
  lensError,
  lensPending,
  onGoalWeightInput,
  onGoalSave,
  onLensToggle,
}: {
  state: RequestState<ProfileResponse>
  goalWeightInput: string
  goalSaving: boolean
  goalError: string | null
  lensError: string | null
  lensPending: Set<LensKey>
  onGoalWeightInput: (value: string) => void
  onGoalSave: () => void
  onLensToggle: (key: LensKey, enabled: boolean) => void
}) {
  if (state.status === 'loading') {
    return <SectionCard title="目標設定" iconName="flag">読み込み中...</SectionCard>
  }
  if (state.status === 'error') {
    return <SectionCard title="目標設定" iconName="flag">読み込み失敗: {state.error}</SectionCard>
  }

  return (
    <SectionCard title="目標設定" iconName="flag">
      <GoalWeightEditor goalWeightInput={goalWeightInput} goalSaving={goalSaving} onGoalWeightInput={onGoalWeightInput} onGoalSave={onGoalSave} />
      <LensToggleList profile={state.data} lensPending={lensPending} onLensToggle={onLensToggle} />
      {goalError ? <div className="my-error-text">{goalError}</div> : null}
      {lensError ? <div className="my-error-text">{lensError}</div> : null}
    </SectionCard>
  )
}

function DataStatusSection({ state }: { state: RequestState<ConnectionStatusResponse> }) {
  if (state.status === 'loading') {
    return <SectionCard title="データの状態" iconName="sync">読み込み中...</SectionCard>
  }
  if (state.status === 'error') {
    return <SectionCard title="データの状態" iconName="sync">読み込み失敗: {state.error}</SectionCard>
  }

  const statusItems = [
    { label: '体重', ok: state.data.has_weight_data },
    { label: '睡眠', ok: state.data.has_sleep_data },
    { label: '活動', ok: state.data.has_activity_data },
    { label: '血圧', ok: state.data.has_vitals_data },
    { label: '食事', ok: state.data.total_records > 0 },
  ]

  return (
    <SectionCard title="データの状態" iconName="sync">
      <div style={{ marginBottom: '12px', color: 'var(--text-secondary, var(--text-muted))', fontSize: '13px', textAlign: 'right' }}>
        最終同期: {formatRelativeTime(state.data.last_sync_at)}
      </div>
      <div className="my-status-grid">
        {statusItems.map((item) => (
          <div key={item.label} className="my-status-item">
            <span className="my-status-label">{item.label}</span>
            <StatusFlag ok={item.ok} />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function AiReportSection({ state }: { state: RequestState<AiReportState> }) {
  if (state.status === 'loading') {
    return <SectionCard title="AIシステム" iconName="smart_toy">読み込み中...</SectionCard>
  }
  if (state.status === 'error') {
    return <SectionCard title="AIシステム" iconName="smart_toy">読み込み失敗: {state.error}</SectionCard>
  }

  const rate = usageRate(state.data.usage)
  const color = usageBarColor(rate)

  return (
    <SectionCard title="AIシステム" iconName="smart_toy">
      <InfoRow label="使用モデル" value={state.data.config.display_name} />
      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary, var(--text-muted))', marginBottom: '4px' }}>
          <span>今月の利用</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(rate)}%</span>
        </div>
        <div className="my-usage-bar-container">
          <div className="my-usage-bar" style={{ width: `${rate}%`, backgroundColor: color }} />
        </div>
      </div>
    </SectionCard>
  )
}

function updatePendingSet(current: Set<LensKey>, key: LensKey, pending: boolean): Set<LensKey> {
  const next = new Set(current)
  if (pending) {
    next.add(key)
  } else {
    next.delete(key)
  }
  return next
}

function useConnectionResource(): RequestState<ConnectionStatusResponse> {
  const [state, setState] = useState<RequestState<ConnectionStatusResponse>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void fetchConnectionStatus()
      .then((data) => alive && setState({ status: 'success', data }))
      .catch((error) => alive && setState({ status: 'error', error: getErrorMessage(error, '状態を取得できませんでした') }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

function useAiResource(): RequestState<AiReportState> {
  const [state, setState] = useState<RequestState<AiReportState>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void Promise.all([fetchGeminiUsage(), fetchAiConfig()])
      .then(([usage, config]) => alive && setState({ status: 'success', data: { usage, config } }))
      .catch((error) => alive && setState({ status: 'error', error: getErrorMessage(error, 'AI情報を取得できませんでした') }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

function useProfileResource() {
  const [profileState, setProfileState] = useState<RequestState<ProfileResponse>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void fetchProfile()
      .then((profile) => alive && setProfileState({ status: 'success', data: profile }))
      .catch((error) => alive && setProfileState({ status: 'error', error: getErrorMessage(error, 'プロフィールを取得できませんでした') }))
    return () => {
      alive = false
    }
  }, [])
  const applyProfileUpdate = (profile: ProfileResponse) => {
    setProfileState({ status: 'success', data: profile })
  }
  return { profileState, applyProfileUpdate }
}

function useProfileEditorState(profileState: RequestState<ProfileResponse>, applyProfileUpdate: (profile: ProfileResponse) => void) {
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  useEffect(() => { if (profileState.status === 'success' && !isEditingProfile) setProfileForm(createProfileForm(profileState.data)) }, [profileState, isEditingProfile])
  const handleStartEdit = () => {
    if (profileState.status !== 'success') return
    setProfileForm(createProfileForm(profileState.data))
    setProfileError(null)
    setIsEditingProfile(true)
  }

  const handleCancelEdit = () => {
    if (profileState.status !== 'success') return
    setProfileForm(createProfileForm(profileState.data))
    setProfileError(null)
    setIsEditingProfile(false)
  }
  const handleProfileSave = async () => {
    if (!profileForm) return
    setProfileSaving(true)
    setProfileError(null)
    try {
      const patch = buildProfilePatch(profileForm)
      const updated = await saveProfile(patch)
      applyProfileUpdate(updated)
      setIsEditingProfile(false)
    } catch (error) {
      setProfileError(getErrorMessage(error, 'プロフィールの保存に失敗しました'))
    } finally {
      setProfileSaving(false)
    }
  }
  return {
    isEditingProfile,
    profileForm,
    setProfileForm,
    profileSaving,
    profileError,
    handleStartEdit,
    handleCancelEdit,
    handleProfileSave,
  }
}

function useGoalState(profileState: RequestState<ProfileResponse>, applyProfileUpdate: (profile: ProfileResponse) => void) {
  const [goalWeightInput, setGoalWeightInput] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)
  useEffect(() => {
    if (profileState.status === 'success') {
      setGoalWeightInput(toInputValue(profileState.data.goal_weight_kg))
    }
  }, [profileState])
  const handleGoalSave = async () => {
    setGoalSaving(true)
    setGoalError(null)
    try {
      const goalWeight = parseOptionalNumberInput(goalWeightInput, 20, 300, '目標体重')
      const updated = await saveProfile({ goal_weight_kg: goalWeight })
      applyProfileUpdate(updated)
    } catch (error) {
      setGoalError(getErrorMessage(error, '目標体重の保存に失敗しました'))
    } finally {
      setGoalSaving(false)
    }
  }
  return { goalWeightInput, setGoalWeightInput, goalSaving, goalError, handleGoalSave }
}

function useLensState(applyProfileUpdate: (profile: ProfileResponse) => void) {
  const [lensPending, setLensPending] = useState<Set<LensKey>>(new Set())
  const [lensError, setLensError] = useState<string | null>(null)
  const handleLensToggle = async (key: LensKey, enabled: boolean) => {
    setLensPending((current) => updatePendingSet(current, key, true))
    setLensError(null)
    try {
      const updated = await saveProfile(createLensPatch(key, enabled))
      applyProfileUpdate(updated)
    } catch (error) {
      setLensError(getErrorMessage(error, '関心レンズの保存に失敗しました'))
    } finally {
      setLensPending((current) => updatePendingSet(current, key, false))
    }
  }
  return { lensPending, lensError, handleLensToggle }
}

export default function MyScreen() {
  const { profileState, applyProfileUpdate } = useProfileResource()
  const connectionState = useConnectionResource()
  const aiState = useAiResource()
  const profileEditor = useProfileEditorState(profileState, applyProfileUpdate)
  const goalState = useGoalState(profileState, applyProfileUpdate)
  const lensState = useLensState(applyProfileUpdate)

  return (
    <div className="home-container">
      <DateNavBar />
      <div className="my-container">
        <ProfileSection
          state={profileState}
          isEditing={profileEditor.isEditingProfile}
          form={profileEditor.profileForm}
          saving={profileEditor.profileSaving}
          error={profileEditor.profileError}
          onStartEdit={profileEditor.handleStartEdit}
          onCancelEdit={profileEditor.handleCancelEdit}
          onSave={() => void profileEditor.handleProfileSave()}
          onFormChange={profileEditor.setProfileForm}
        />
        <GoalSection
          state={profileState}
          goalWeightInput={goalState.goalWeightInput}
          goalSaving={goalState.goalSaving}
          goalError={goalState.goalError}
          lensError={lensState.lensError}
          lensPending={lensState.lensPending}
          onGoalWeightInput={goalState.setGoalWeightInput}
          onGoalSave={() => void goalState.handleGoalSave()}
          onLensToggle={(key, enabled) => void lensState.handleLensToggle(key, enabled)}
        />
        <DataStatusSection state={connectionState} />
        <AiReportSection state={aiState} />
      </div>
    </div>
  )
}
