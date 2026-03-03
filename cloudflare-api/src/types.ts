export type D1Database = any
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}
export type ExportedHandler<E> = {
  fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response>
}

export interface Env {
  DB: D1Database
  API_KEY?: string
  MOCK_SEED_TOKEN?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
  LLM_PROVIDER?: string
}

export type ReportType = 'daily' | 'weekly' | 'monthly'
export type SexType = 'male' | 'female' | 'other'
export type WeightGoalType = 'lose' | 'gain' | 'maintain'
export type ExerciseFreqType = 'none' | 'weekly12' | 'weekly35' | 'daily'
export type ExerciseType = 'walk' | 'gym' | 'run' | 'bodyweight' | 'none'
export type ExerciseIntensityType = 'light' | 'moderate' | 'high'

export interface DailyMetricRow {
  date: string
  steps: number | null
  distance_km: number | null
  active_kcal: number | null
  total_kcal: number | null
  intake_kcal: number | null
  sleep_hours: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  resting_bpm: number | null
  heart_bpm: number | null
  spo2_pct: number | null
  blood_systolic: number | null
  blood_diastolic: number | null
  bmr_kcal: number | null
  record_count: number
}

export interface NutritionEventRow {
  id: number
  consumed_at: string
  local_date: string
  alias: string | null
  label: string
  count: number
  unit: string | null
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  micros_json: string | null
  note: string | null
}

export interface ProfileRow {
  id: number
  name: string | null
  height_cm: number | null
  birth_year: number | null
  sex: SexType | null
  goal_weight_kg: number | null
  sleep_goal_minutes?: number | null
  steps_goal?: number | null
  updated_at: string
}

export interface UserProfileRow {
  user_id: string
  age: number | null
  gender: SexType | null
  height_cm: number | null
  goal_weight_kg: number | null
  sleep_goal_minutes: number
  steps_goal: number
  weight_goal: WeightGoalType | null
  bp_goal_systolic: number | null
  bp_goal_diastolic: number | null
  lens_weight: number | null
  lens_bp: number | null
  lens_sleep: number | null
  lens_performance: number | null
  exercise_freq: ExerciseFreqType | null
  exercise_type: ExerciseType | null
  exercise_intensity: ExerciseIntensityType | null
  created_at: string | null
  updated_at: string | null
}

export interface ReportRow {
  id: number
  report_date: string
  report_type: ReportType
  prompt_used: string
  content: string
  created_at: string
}

export interface DailyReportRow {
  date: string
  headline: string
  yu_comment: string
  saki_comment: string
  mai_comment: string
  condition_comment: string
  activity_comment: string
  meal_comment: string
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  generated_at: string
  created_at: string
}

export interface DailyReportGeneratedPayload {
  headline: string
  yu_comment: string
  saki_comment: string
  mai_comment: string
  condition_comment: string
  activity_comment: string
  meal_comment: string
}

export interface AnthropicMessageResponse {
  id?: string
  model?: string
  content?: Array<{ type?: string; text?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export interface OpenAICompatibleResponse {
  model?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  modelVersion?: string
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

export interface HealthRecordRow {
  record_key: string
  device_id: string
  type: string
  record_id: string | null
  source: string | null
  start_time: string | null
  end_time: string | null
  time: string | null
  last_modified_time: string | null
  unit: string | null
  payload_json: string
  ingested_at: string
}

export interface SyncRecordInput {
  type: string
  recordId?: string
  recordKey?: string
  source?: string
  startTime?: string
  endTime?: string
  time?: string
  lastModifiedTime?: string
  unit?: string
  payload?: unknown
}

export interface SyncRequestInput {
  deviceId: string
  syncId: string
  syncedAt: string
  rangeStart: string
  rangeEnd: string
  records: SyncRecordInput[]
  requiredPermissions?: string[]
  grantedPermissions?: string[]
}

export interface CatalogItem {
  alias: string
  label: string
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  unit: string
  micros?: Record<string, number>
}
