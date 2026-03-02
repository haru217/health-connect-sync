import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { saveProfile } from '../api/healthApi'
import type { ProfileResponse, ProfileUpdateRequest } from '../api/types'
import './SetupScreen.css'

type GenderOption = 'male' | 'female' | 'other' | ''
type WeightGoalOption = 'lose' | 'gain' | 'maintain' | ''
type ExerciseFreqOption = 'none' | 'weekly12' | 'weekly35' | 'daily'
type ExerciseTypeOption = 'walk' | 'gym' | 'run' | 'bodyweight' | 'none'
type ExerciseIntensityOption = 'light' | 'moderate' | 'high'

type SetupFormState = {
  age: string
  gender: GenderOption
  heightCm: string
  lensWeight: boolean
  lensBp: boolean
  lensSleep: boolean
  lensPerformance: boolean
  weightGoal: WeightGoalOption
  bpGoalSystolic: string
  bpGoalDiastolic: string
  exerciseFreq: ExerciseFreqOption
  exerciseType: ExerciseTypeOption
  exerciseIntensity: ExerciseIntensityOption
}

type SetupScreenProps = {
  readonly initialProfile: ProfileResponse | null
  readonly onComplete: (profile: ProfileResponse | null) => void
  readonly onSkip: () => void
}

const TOTAL_STEPS = 4

function toInputValue(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  return String(value)
}

function parseOptionalInteger(value: string, min: number, max: number): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${min}〜${max}の整数で入力してください`)
  }
  return parsed
}

function parseOptionalNumber(value: string, min: number, max: number): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${min}〜${max}の範囲で入力してください`)
  }
  return Number(parsed.toFixed(1))
}

function createInitialState(profile: ProfileResponse | null): SetupFormState {
  return {
    age: toInputValue(profile?.age),
    gender: profile?.gender ?? '',
    heightCm: toInputValue(profile?.height_cm),
    lensWeight: profile?.lens_weight === 1,
    lensBp: profile?.lens_bp === 1,
    lensSleep: profile?.lens_sleep === 1,
    lensPerformance: profile?.lens_performance === 1,
    weightGoal: profile?.weight_goal ?? '',
    bpGoalSystolic: toInputValue(profile?.bp_goal_systolic),
    bpGoalDiastolic: toInputValue(profile?.bp_goal_diastolic),
    exerciseFreq: profile?.exercise_freq ?? 'none',
    exerciseType: profile?.exercise_type ?? 'none',
    exerciseIntensity: profile?.exercise_intensity ?? 'moderate',
  }
}

export default function SetupScreen({ initialProfile, onComplete, onSkip }: SetupScreenProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<SetupFormState>(() => createInitialState(initialProfile))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedProfile, setSavedProfile] = useState<ProfileResponse | null>(null)

  const progress = useMemo(() => (step / TOTAL_STEPS) * 100, [step])

  const validateStep1 = () => {
    parseOptionalInteger(form.age, 0, 130)
    parseOptionalNumber(form.heightCm, 80, 250)
  }

  const validateStep2 = () => {
    if (form.lensWeight && !form.weightGoal) {
      throw new Error('体重・体型の目的を選択してください')
    }
    const systolic = parseOptionalInteger(form.bpGoalSystolic, 70, 250)
    const diastolic = parseOptionalInteger(form.bpGoalDiastolic, 40, 150)
    if (systolic != null && diastolic != null && diastolic >= systolic) {
      throw new Error('血圧目標は上が下より高くなるよう入力してください')
    }
  }

  const buildPayload = (): ProfileUpdateRequest => {
    const age = parseOptionalInteger(form.age, 0, 130)
    const heightCm = parseOptionalNumber(form.heightCm, 80, 250)
    const bpGoalSystolic = parseOptionalInteger(form.bpGoalSystolic, 70, 250)
    const bpGoalDiastolic = parseOptionalInteger(form.bpGoalDiastolic, 40, 150)

    return {
      age,
      gender: form.gender || null,
      height_cm: heightCm,
      weight_goal: form.lensWeight ? (form.weightGoal || null) : null,
      bp_goal_systolic: form.lensBp ? bpGoalSystolic : null,
      bp_goal_diastolic: form.lensBp ? bpGoalDiastolic : null,
      lens_weight: form.lensWeight ? 1 : 0,
      lens_bp: form.lensBp ? 1 : 0,
      lens_sleep: form.lensSleep ? 1 : 0,
      lens_performance: form.lensPerformance ? 1 : 0,
      exercise_freq: form.exerciseFreq,
      exercise_type: form.exerciseType,
      exercise_intensity: form.exerciseIntensity,
    }
  }

  const onNext = async () => {
    setError(null)
    try {
      if (step === 1) {
        validateStep1()
        setStep(2)
        return
      }
      if (step === 2) {
        validateStep2()
        setStep(3)
        return
      }
      if (step === 3) {
        setSaving(true)
        const payload = buildPayload()
        const updated = await saveProfile(payload)
        setSavedProfile(updated)
        setStep(4)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '入力内容を確認してください')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="setup-screen">
      <div className="setup-topbar">
        <h2 className="setup-title">初回セットアップ</h2>
        {step < 4 ? (
          <button type="button" className="setup-skip-button" onClick={onSkip} disabled={saving}>
            スキップ
          </button>
        ) : null}
      </div>

      <p className="setup-caption">はじめに、健康アドバイスの初期設定を行います。</p>

      <div className="setup-progress-wrap" aria-label="進捗">
        <div className="setup-progress-track">
          <div className="setup-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="setup-progress-text">Step {step} / {TOTAL_STEPS}</div>
      </div>

      <div className="setup-panel fade-in">
        {step === 1 ? (
          <StepBasicInfo form={form} onChange={setForm} />
        ) : null}
        {step === 2 ? (
          <StepLens form={form} onChange={setForm} />
        ) : null}
        {step === 3 ? (
          <StepExercise form={form} onChange={setForm} />
        ) : null}
        {step === 4 ? (
          <StepDone onComplete={() => onComplete(savedProfile)} />
        ) : null}
      </div>

      {error ? <p className="setup-error">{error}</p> : null}

      {step < 4 ? (
        <div className="setup-actions">
          {step > 1 ? (
            <button
              type="button"
              className="setup-secondary-button"
              onClick={() => {
                setError(null)
                setStep((prev) => Math.max(1, prev - 1))
              }}
              disabled={saving}
            >
              戻る
            </button>
          ) : (
            <span />
          )}

          <button type="button" className="setup-primary-button" onClick={() => void onNext()} disabled={saving}>
            {step === 3 ? (saving ? '保存中...' : '保存して次へ') : '次へ'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function StepBasicInfo({
  form,
  onChange,
}: {
  readonly form: SetupFormState
  readonly onChange: Dispatch<SetStateAction<SetupFormState>>
}) {
  const genderOptions: Array<{ value: GenderOption; label: string }> = [
    { value: 'male', label: '男性' },
    { value: 'female', label: '女性' },
    { value: 'other', label: 'その他' },
    { value: '', label: '回答しない' },
  ]

  return (
    <div className="setup-step">
      <h3 className="setup-step-title">基本情報</h3>
      <p className="setup-step-caption">年齢・性別・身長を設定します（後から変更できます）。</p>

      <label className="setup-field">
        <span className="setup-field-label">年齢</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={130}
          value={form.age}
          onChange={(event) => onChange((prev) => ({ ...prev, age: event.target.value }))}
          className="setup-input"
          placeholder="例: 35"
        />
      </label>

      <div className="setup-field">
        <span className="setup-field-label">性別</span>
        <div className="setup-chip-grid">
          {genderOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`setup-chip ${form.gender === option.value ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, gender: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="setup-field">
        <span className="setup-field-label">身長（cm）</span>
        <input
          type="number"
          inputMode="decimal"
          min={80}
          max={250}
          value={form.heightCm}
          onChange={(event) => onChange((prev) => ({ ...prev, heightCm: event.target.value }))}
          className="setup-input"
          placeholder="例: 170"
        />
      </label>
    </div>
  )
}

function StepLens({
  form,
  onChange,
}: {
  readonly form: SetupFormState
  readonly onChange: Dispatch<SetStateAction<SetupFormState>>
}) {
  const weightGoals: Array<{ value: WeightGoalOption; label: string }> = [
    { value: 'lose', label: '減量' },
    { value: 'gain', label: '増量' },
    { value: 'maintain', label: '維持' },
  ]

  return (
    <div className="setup-step">
      <h3 className="setup-step-title">目的レンズ</h3>
      <p className="setup-step-caption">重視したいテーマを選ぶと、コメントの優先度が調整されます。</p>

      <div className="setup-toggle-list">
        <ToggleItem
          label="体重・体型最適化"
          checked={form.lensWeight}
          onToggle={() => onChange((prev) => ({ ...prev, lensWeight: !prev.lensWeight }))}
        />
        {form.lensWeight ? (
          <div className="setup-subsection">
            <span className="setup-field-label">目標</span>
            <div className="setup-chip-grid">
              {weightGoals.map((goal) => (
                <button
                  key={goal.value}
                  type="button"
                  className={`setup-chip ${form.weightGoal === goal.value ? 'active' : ''}`}
                  onClick={() => onChange((prev) => ({ ...prev, weightGoal: goal.value }))}
                >
                  {goal.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ToggleItem
          label="血圧改善"
          checked={form.lensBp}
          onToggle={() => onChange((prev) => ({ ...prev, lensBp: !prev.lensBp }))}
        />
        {form.lensBp ? (
          <div className="setup-subsection setup-subsection-grid">
            <label className="setup-field">
              <span className="setup-field-label">目標上（任意）</span>
              <input
                type="number"
                inputMode="numeric"
                min={70}
                max={250}
                value={form.bpGoalSystolic}
                onChange={(event) => onChange((prev) => ({ ...prev, bpGoalSystolic: event.target.value }))}
                className="setup-input"
                placeholder="例: 120"
              />
            </label>
            <label className="setup-field">
              <span className="setup-field-label">目標下（任意）</span>
              <input
                type="number"
                inputMode="numeric"
                min={40}
                max={150}
                value={form.bpGoalDiastolic}
                onChange={(event) => onChange((prev) => ({ ...prev, bpGoalDiastolic: event.target.value }))}
                className="setup-input"
                placeholder="例: 80"
              />
            </label>
          </div>
        ) : null}

        <ToggleItem
          label="睡眠改善"
          checked={form.lensSleep}
          onToggle={() => onChange((prev) => ({ ...prev, lensSleep: !prev.lensSleep }))}
        />
        <ToggleItem
          label="パフォーマンス最適化"
          checked={form.lensPerformance}
          onToggle={() => onChange((prev) => ({ ...prev, lensPerformance: !prev.lensPerformance }))}
        />
      </div>
    </div>
  )
}

function StepExercise({
  form,
  onChange,
}: {
  readonly form: SetupFormState
  readonly onChange: Dispatch<SetStateAction<SetupFormState>>
}) {
  const freqOptions: Array<{ value: ExerciseFreqOption; label: string }> = [
    { value: 'none', label: 'ほぼなし' },
    { value: 'weekly12', label: '週1-2' },
    { value: 'weekly35', label: '週3-5' },
    { value: 'daily', label: '毎日' },
  ]
  const typeOptions: Array<{ value: ExerciseTypeOption; label: string }> = [
    { value: 'walk', label: '散歩' },
    { value: 'gym', label: 'ジム' },
    { value: 'run', label: 'ランニング' },
    { value: 'bodyweight', label: '自重' },
    { value: 'none', label: 'なし' },
  ]
  const intensityOptions: Array<{ value: ExerciseIntensityOption; label: string }> = [
    { value: 'light', label: '軽め' },
    { value: 'moderate', label: '中程度' },
    { value: 'high', label: '高強度OK' },
  ]

  return (
    <div className="setup-step">
      <h3 className="setup-step-title">運動プロフィール</h3>
      <p className="setup-step-caption">現在の運動習慣に合わせて、提案の強さを調整します。</p>

      <div className="setup-field">
        <span className="setup-field-label">運動頻度</span>
        <div className="setup-chip-grid">
          {freqOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`setup-chip ${form.exerciseFreq === option.value ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, exerciseFreq: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-field">
        <span className="setup-field-label">運動種別</span>
        <div className="setup-chip-grid">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`setup-chip ${form.exerciseType === option.value ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, exerciseType: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-field">
        <span className="setup-field-label">運動強度</span>
        <div className="setup-chip-grid">
          {intensityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`setup-chip ${form.exerciseIntensity === option.value ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, exerciseIntensity: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepDone({ onComplete }: { readonly onComplete: () => void }) {
  return (
    <div className="setup-step">
      <h3 className="setup-step-title">設定完了</h3>
      <p className="setup-step-caption">
        これで初期設定は完了です。日々の記録に合わせて、ホーム画面のコメントが最適化されます。
      </p>
      <button type="button" className="setup-primary-button setup-done-button" onClick={onComplete}>
        ホームへ進む
      </button>
    </div>
  )
}

function ToggleItem({
  label,
  checked,
  onToggle,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`setup-toggle-item ${checked ? 'active' : ''}`}
      onClick={onToggle}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span className={`setup-toggle-pill ${checked ? 'active' : ''}`}>{checked ? 'ON' : 'OFF'}</span>
    </button>
  )
}
